import type { Order, OrderItem } from '../types';
import { getPaymentMethodLabel, getServiceModeLabel } from './orderLabels';

type ReceiptItem = Pick<OrderItem, 'item_name' | 'quantity' | 'unit_price'> & {
  customizations: unknown;
};

type ReceiptCustomization = {
  group_name: string;
  option_name: string;
  price: number;
};

function toNumber(value: unknown) {
  const numericValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function formatCurrency(value: number) {
  return `Rs. ${new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}

function titleCase(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeCustomizations(value: unknown): ReceiptCustomization[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];

    const row = entry as Record<string, unknown>;

    return [{
      group_name: typeof row.group_name === 'string' ? row.group_name : 'Option',
      option_name: typeof row.option_name === 'string' ? row.option_name : 'Selected',
      price: toNumber(row.price),
    }];
  });
}

function buildRows(items: ReceiptItem[]) {
  return items.map((item) => {
    const customizations = normalizeCustomizations(item.customizations);
    const customizationTotal = customizations.reduce((sum, customization) => sum + customization.price, 0);
    const unitTotal = toNumber(item.unit_price) + customizationTotal;
    const quantity = Math.max(1, toNumber(item.quantity));

    return {
      ...item,
      customizations,
      quantity,
      unitTotal,
      lineTotal: unitTotal * quantity,
    };
  });
}

function safeFilename(orderId: string) {
  return `receipt-${orderId}`.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-');
}

export async function downloadOrderReceiptPdf(order: Order, items: ReceiptItem[]) {
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (heightNeeded: number) => {
    if (y + heightNeeded <= pageHeight - margin) return;
    doc.addPage();
    y = margin;
  };

  const drawDivider = () => {
    doc.setDrawColor(226, 226, 226);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
  };

  const addLabelValue = (label: string, value: string) => {
    const labelWidth = 34;
    const textLines = doc.splitTextToSize(value || '-', contentWidth - labelWidth) as string[];
    const rowHeight = Math.max(5, textLines.length * 4.6);

    ensureSpace(rowHeight + 1);
    doc.setFont('helvetica', 'bold');
    doc.text(label, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(textLines, margin + labelWidth, y);
    y += rowHeight;
  };

  const addAmountRow = (label: string, value: string, isEmphasized = false) => {
    ensureSpace(6);
    doc.setFont('helvetica', isEmphasized ? 'bold' : 'normal');
    doc.setFontSize(isEmphasized ? 12 : 10);
    doc.text(label, pageWidth - margin - 54, y);
    doc.text(value, pageWidth - margin, y, { align: 'right' });
    y += isEmphasized ? 7 : 6;
  };

  const receiptRows = buildRows(items);

  doc.setTextColor(24, 24, 27);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('The Supreme Waffle', margin, y);
  y += 8;

  doc.setFontSize(12);
  doc.text('Order Receipt', margin, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Generated from admin panel on ${formatDate(new Date().toISOString())}`, margin, y);
  y += 6;

  drawDivider();

  doc.setFontSize(10);
  addLabelValue('Order ID', order.order_id);
  addLabelValue('Placed', formatDate(order.placed_at));
  addLabelValue('Customer', order.customer_name);
  addLabelValue('Phone', order.customer_phone || '-');

  if (order.customer_email) {
    addLabelValue('Email', order.customer_email);
  }

  addLabelValue('Service', getServiceModeLabel(order));
  addLabelValue('Payment', getPaymentMethodLabel(order));
  addLabelValue('Status', titleCase(order.status));

  if (order.order_type === 'delivery' && order.address) {
    const destination = order.pincode ? `${order.address}, ${order.pincode}` : order.address;
    addLabelValue('Address', destination);
  }

  y += 2;
  drawDivider();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Items', margin, y);
  y += 6;

  if (receiptRows.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('No item details available for this order.', margin, y);
    y += 7;
  }

  receiptRows.forEach((item) => {
    const titleLines = doc.splitTextToSize(`${item.item_name} x${item.quantity}`, contentWidth - 38) as string[];
    const detailLines = [
      `${formatCurrency(item.unit_price)} each`,
      ...item.customizations.map((customization) => {
        const priceLabel = customization.price > 0 ? ` (+${formatCurrency(customization.price)})` : '';
        return `${customization.group_name}: ${customization.option_name}${priceLabel}`;
      }),
    ].flatMap((line) => doc.splitTextToSize(line, contentWidth - 6) as string[]);
    const blockHeight = titleLines.length * 5 + detailLines.length * 4.2 + 4;

    ensureSpace(blockHeight + 3);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(titleLines, margin, y);
    doc.text(formatCurrency(item.lineTotal), pageWidth - margin, y, { align: 'right' });
    y += titleLines.length * 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    detailLines.forEach((line) => {
      doc.text(line, margin + 3, y);
      y += 4.2;
    });

    y += 1;
    drawDivider();
  });

  y += 1;
  addAmountRow('Subtotal', formatCurrency(toNumber(order.subtotal)));

  if (toNumber(order.discount) > 0) {
    addAmountRow('Discount', `- ${formatCurrency(toNumber(order.discount))}`);
  }

  if (toNumber(order.delivery_fee) > 0) {
    addAmountRow('Delivery Fee', formatCurrency(toNumber(order.delivery_fee)));
  }

  drawDivider();
  addAmountRow('Total', formatCurrency(toNumber(order.total)), true);

  y += 4;
  ensureSpace(8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text('Admin copy. Generated for store records.', margin, y);

  doc.save(`${safeFilename(order.order_id)}.pdf`);
}
