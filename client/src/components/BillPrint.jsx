/**
 * BillPrint.jsx
 * Opens a new window and prints an 80mm thermal-style receipt.
 * Called from OrderDetailsModal when isPaid === true.
 */

export const printBill = (order, formatPrice) => {
    const isPaid = order.paymentStatus === 'paid';

    const date = new Date(order.createdAt).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });

    const activeItems = order.items.filter(
        (item) => item.status !== 'CANCELLED' && item.status !== 'Cancelled'
    );

    const itemRows = activeItems
        .map(
            (item) => `
        <tr>
            <td style="padding:3px 0;font-size:11.5px;word-break:break-word;">${item.name}</td>
            <td style="padding:3px 0;font-size:11.5px;text-align:center;">${item.quantity}</td>
            <td style="padding:3px 0;font-size:11.5px;text-align:right;">${formatPrice(item.price)}</td>
            <td style="padding:3px 0;font-size:11.5px;text-align:right;font-weight:bold;">${formatPrice(item.price * item.quantity)}</td>
        </tr>`
        )
        .join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Bill — ${order.orderNumber}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    width: 302px;
    max-width: 302px;
    margin: 0 auto;
    padding: 10px 8px 16px;
    color: #000;
    background: #fff;
  }
  .center { text-align: center; }
  .right  { text-align: right; }
  .bold   { font-weight: bold; }
  .dash   { border-top: 1px dashed #000; margin: 6px 0; }
  .solid  { border-top: 1px solid  #000; margin: 6px 0; }
  .row    { display:flex; justify-content:space-between; margin:3px 0; font-size:11.5px; }
  .grand  { display:flex; justify-content:space-between; font-weight:bold; font-size:14px; margin-top:4px; }
  table   { width:100%; border-collapse:collapse; margin-top:4px; }
  th      { font-size:10.5px; text-align:left; padding:2px 0 4px; border-bottom:1px dashed #000; font-weight:bold; }
  .badge  { display:inline-block; border:1.5px solid #000; padding:1px 8px; font-weight:bold; font-size:12px; letter-spacing:1px; }
  @page   { margin:0; size:80mm auto; }
  @media print { body { width:80mm; } }
</style>
</head>
<body>

<div class="center bold" style="font-size:17px;letter-spacing:1px;">KAGZSO RESTAURANT</div>
<div class="center" style="font-size:10px;margin-top:2px;color:#555;">Restaurant POS System</div>
<div class="solid" style="margin-top:8px;"></div>

<div class="row"><span>Order ID</span><span class="bold">${order.orderNumber}</span></div>
<div class="row"><span>Token</span><span class="bold">#${order.tokenNumber || '—'}</span></div>
<div class="row"><span>Date &amp; Time</span><span>${date}</span></div>
<div class="row"><span>Order Type</span><span class="bold">${order.orderType === 'dine-in' ? 'Dine-In' : 'Takeaway'}</span></div>
${order.orderType === 'dine-in'
    ? `<div class="row"><span>Table</span><span class="bold">Table ${order.tableId?.number || order.tableId || '—'}</span></div>`
    : ''}
${order.customerInfo?.name
    ? `<div class="row"><span>Customer</span><span>${order.customerInfo.name}</span></div>`
    : ''}
${order.customerInfo?.phone
    ? `<div class="row"><span>Phone</span><span>${order.customerInfo.phone}</span></div>`
    : ''}

<div class="dash"></div>

<table>
  <thead>
    <tr>
      <th style="width:42%;">Item</th>
      <th style="text-align:center;width:10%;">Qty</th>
      <th style="text-align:right;width:22%;">Rate</th>
      <th style="text-align:right;width:26%;">Amt</th>
    </tr>
  </thead>
  <tbody>
    ${itemRows}
  </tbody>
</table>

<div class="dash"></div>

<div class="row"><span>Subtotal</span><span>${formatPrice(order.totalAmount)}</span></div>
<div class="row"><span>GST</span><span>${formatPrice(order.tax || 0)}</span></div>
${order.discount > 0
    ? `<div class="row"><span>Discount</span><span>&#8722; ${formatPrice(order.discount)}</span></div>`
    : ''}

<div class="solid"></div>
<div class="grand"><span>GRAND TOTAL</span><span>${formatPrice(order.finalAmount)}</span></div>

<div class="dash" style="margin-top:8px;"></div>

<div class="row">
  <span class="bold">Payment Status</span>
  <span class="badge">${isPaid ? 'PAID' : 'UNPAID'}</span>
</div>
${isPaid && order.paymentMethod
    ? `<div class="row"><span>Method</span><span class="bold">${order.paymentMethod.toUpperCase().replace('_', ' ')}</span></div>`
    : ''}
${order.paidAt
    ? `<div class="row"><span>Paid At</span><span>${new Date(order.paidAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span></div>`
    : ''}

<div class="solid" style="margin-top:8px;"></div>
<div class="center" style="font-size:11px;margin:6px 0 2px;">Thank you for dining with us!</div>
<div class="center" style="font-size:10px;color:#555;">Please visit again &#9829;</div>
<div class="center" style="font-size:9px;margin-top:6px;color:#aaa;">Powered by Kagzso POS</div>

</body>
</html>`;

    const win = window.open('', '_blank', 'width=400,height=680,scrollbars=yes');
    if (!win) {
        alert('Please allow pop-ups in your browser to print the bill.');
        return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    // Small delay so the browser renders the DOM before print dialog opens
    setTimeout(() => {
        win.print();
        win.onafterprint = () => win.close();
    }, 300);
};
