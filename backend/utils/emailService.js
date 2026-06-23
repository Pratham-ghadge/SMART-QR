const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');

const generatePdfBuffer = async (order, customer, store) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];

      doc.on('data', buffer => buffers.push(buffer));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Helper function for drawing a horizontal line
      const drawLine = (y) => {
        doc.strokeColor('#aaaaaa')
           .lineWidth(1)
           .moveTo(50, y)
           .lineTo(550, y)
           .stroke();
      };

      // Header: Store details
      doc.fontSize(24).font('Helvetica-Bold').text(store.name || 'Store Name', { align: 'center' });
      doc.fontSize(10).font('Helvetica').text(store.address || 'Store Address', { align: 'center' });
      doc.text(store.phone || '', { align: 'center' });
      doc.moveDown();
      drawLine(doc.y);
      doc.moveDown();

      // Invoice Details
      doc.fontSize(16).font('Helvetica-Bold').text('INVOICE / RECEIPT');
      doc.fontSize(10).font('Helvetica');
      doc.text(`Invoice Number: INV-${order._id.toString().substring(18).toUpperCase()}-${Date.now().toString().slice(-4)}`);
      doc.text(`Date: ${new Date().toLocaleString()}`);
      doc.moveDown();

      // Customer Details
      doc.font('Helvetica-Bold').text('Customer Details:');
      doc.font('Helvetica').text(`Name: ${customer.name || 'N/A'}`);
      doc.text(`Email: ${customer.email || 'N/A'}`);
      doc.text(`Contact: ${customer.phone || 'N/A'}`);
      doc.moveDown();

      // Payment Details
      let paymentTxn = 'N/A';
      if (order.transactions && order.transactions.length > 0) {
        const tx = order.transactions[order.transactions.length - 1];
        paymentTxn = tx.transactionId || tx.razorpayPaymentId || 'N/A';
      }
      doc.font('Helvetica-Bold').text('Payment Details:');
      doc.font('Helvetica').text(`Method: Razorpay`);
      doc.text(`Payment ID: ${paymentTxn}`);
      doc.text(`Order ID: ${order._id}`);
      doc.moveDown();
      drawLine(doc.y);
      doc.moveDown();

      // Items Table Header
      const tableTop = doc.y;
      doc.font('Helvetica-Bold');
      doc.text('Item', 50, tableTop);
      doc.text('Quantity', 300, tableTop, { width: 90, align: 'right' });
      doc.text('Price', 400, tableTop, { width: 60, align: 'right' });
      doc.text('Total', 470, tableTop, { width: 80, align: 'right' });
      
      doc.moveDown();
      drawLine(doc.y);
      doc.moveDown(0.5);

      // Items
      doc.font('Helvetica');
      let currentY = doc.y;
      for (const item of order.cart) {
        // Handle unpopulated product cases if needed
        const itemName = item.productName || (item.productId && item.productId.name) || 'Product';
        const price = item.price || (item.productId && item.productId.price) || 0;
        const total = price * item.quantity;

        doc.text(itemName, 50, currentY, { width: 240 });
        doc.text(item.quantity.toString(), 300, currentY, { width: 90, align: 'right' });
        doc.text(`Rs ${price.toFixed(2)}`, 400, currentY, { width: 60, align: 'right' });
        doc.text(`Rs ${total.toFixed(2)}`, 470, currentY, { width: 80, align: 'right' });
        currentY = doc.y + 10;
      }

      doc.y = currentY;
      drawLine(doc.y);
      doc.moveDown(1);

      // Summary
      const summaryStartX = 350;
      doc.font('Helvetica-Bold');
      doc.text('Subtotal:', summaryStartX, doc.y, { width: 100, align: 'right' });
      doc.text(`Rs ${order.totalAmount.toFixed(2)}`, summaryStartX + 100, doc.y - 12, { width: 100, align: 'right' });
      doc.moveDown(0.5);

      doc.text('Tax (0%):', summaryStartX, doc.y, { width: 100, align: 'right' });
      doc.text('Rs 0.00', summaryStartX + 100, doc.y - 12, { width: 100, align: 'right' });
      doc.moveDown(0.5);

      doc.fontSize(14).text('Total Amount:', summaryStartX, doc.y, { width: 100, align: 'right' });
      doc.text(`Rs ${order.totalAmount.toFixed(2)}`, summaryStartX + 100, doc.y - 14, { width: 100, align: 'right' });
      doc.moveDown(2);

      // Footer
      doc.fontSize(12).font('Helvetica-Bold').text('Payment Status: SUCCESS', 50, doc.y, { align: 'center', color: 'green' });
      doc.moveDown(0.5);
      doc.fillColor('black').font('Helvetica').text('Thank you for shopping with us! Please visit again.', { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

const sendReceiptEmail = async (order, customer, store) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error('Email credentials missing, skipping receipt email.');
      return;
    }

    const pdfBuffer = await generatePdfBuffer(order, customer, store);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: customer.email,
        subject: `Your Receipt from ${store.name || 'our store'} (Order ${order._id})`,
        text: `Dear ${customer.name || 'Customer'},\n\nThank you for shopping at ${store.name || 'our store'}. Please find your receipt attached below.\n\nTotal Paid: Rs ${order.totalAmount}\n\nWe look forward to seeing you again!\n\nBest regards,\n${store.name || 'The Store Team'}`,
        html: `
            <h2>Thank You for Your Order!</h2>
            <p>Dear ${customer.name || 'Customer'},</p>
            <p>Thank you for shopping at <strong>${store.name || 'our store'}</strong>. Your payment of <strong>Rs ${order.totalAmount}</strong> was successful.</p>
            <p>We've attached your digital invoice to this email for your records.</p>
            <br/>
            <p>We hope to see you again soon!</p>
            <p>Best regards,<br/><strong>${store.name || 'The Store Team'}</strong></p>
        `,
        attachments: [
            {
                filename: `Invoice_${order._id}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
            }
        ]
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Invoice sent to ${customer.email} for order ${order._id}`);
  } catch (error) {
    console.error('❌ Failed to send receipt email:', error.message);
  }
};

module.exports = {
  sendReceiptEmail
};
