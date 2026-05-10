import { NextResponse } from "next/server";
import tls from "node:tls";
import { formatPrice } from "../../../lib/format";

const ACTION_CONFIG = {
  created: {
    subject: (order) => `New order received - ${order.id}`,
    title: "New Order Received",
    eyebrow: "Fresh checkout request",
    intro: "A customer has placed a new order. Open the admin panel to confirm or reject this order after reviewing the products, total, and payment screenshot.",
    toAdmin: true
  },
  approved: {
    subject: (order) => `Order confirmed - ${order.id}`,
    title: "Order Confirmed",
    eyebrow: "Freaking Collectibles",
    intro: "Your order has been approved. The seller will prepare it for dispatch.",
    toCustomer: true
  },
  rejected: {
    subject: (order) => `Order update - ${order.id}`,
    title: "Order Rejected",
    eyebrow: "Freaking Collectibles",
    intro: "Your order could not be approved. Please contact the seller if you need help.",
    toCustomer: true
  }
};

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function paymentAttachment(order) {
  const screenshot = order?.paymentScreenshot;
  if (!screenshot?.dataUrl) return [];

  const [, base64 = ""] = String(screenshot.dataUrl).split(",");
  if (!base64) return [];

  return [
    {
      filename: screenshot.name || `payment-${order.id}.png`,
      content: base64
    }
  ];
}

function parseEmailAddress(value) {
  const text = String(value || "");
  const match = text.match(/<([^>]+)>/);
  return (match ? match[1] : text).trim();
}

function encodeHeader(value) {
  return `=?UTF-8?B?${Buffer.from(String(value || ""), "utf8").toString("base64")}?=`;
}

function foldBase64(value) {
  return String(value || "").replace(/(.{1,76})/g, "$1\r\n").trim();
}

function buildMimeEmail({ from, to, subject, html, attachments = [] }) {
  const boundary = `mint-lane-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const attachmentParts = attachments
    .map((attachment) => {
      const filename = attachment.filename || "attachment.png";
      return [
        `--${boundary}`,
        "Content-Type: application/octet-stream",
        "Content-Transfer-Encoding: base64",
        `Content-Disposition: attachment; filename="${filename.replaceAll('"', "")}"`,
        "",
        foldBase64(attachment.content)
      ].join("\r\n");
    })
    .join("\r\n");

  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    foldBase64(Buffer.from(html, "utf8").toString("base64")),
    attachmentParts,
    `--${boundary}--`,
    ""
  ]
    .filter(Boolean)
    .join("\r\n");
}

function orderItemsHtml(order) {
  return (order.items || [])
    .map(
      (item) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e7e9e3;">
            <strong style="color:#111815;">${escapeHtml(item.name)}</strong>
            <span style="display:block;color:#6b746f;margin-top:3px;">Qty ${escapeHtml(item.quantity)}</span>
          </td>
          <td style="padding:12px 0;border-bottom:1px solid #e7e9e3;text-align:right;font-weight:800;color:#111815;">
            ${formatPrice(Number(item.price || 0) * Number(item.quantity || 0))}
          </td>
        </tr>
      `
    )
    .join("");
}

function buildHtml(action, order) {
  const config = ACTION_CONFIG[action];
  const createdAt = order.createdAt ? new Date(order.createdAt).toLocaleString("en-IN") : new Date().toLocaleString("en-IN");
  const screenshotText = order.paymentScreenshot?.name
    ? `Attached: ${escapeHtml(order.paymentScreenshot.name)}`
    : "No payment screenshot attached";
  const paymentUtr = order.paymentUtr ? escapeHtml(order.paymentUtr) : "Not provided";

  return `
    <div style="margin:0;padding:0;background:#f7f8f5;font-family:Georgia,'Times New Roman',serif;color:#111815;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f8f5;padding:32px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border:1px solid #e2e5df;border-radius:14px;overflow:hidden;box-shadow:0 24px 70px rgba(17,24,21,0.10);">
              <tr>
                <td style="height:5px;background:linear-gradient(90deg,#00796b,#0b5e58,#c69a2b);"></td>
              </tr>
              <tr>
                <td style="padding:30px 32px 20px;">
                  <p style="margin:0 0 10px;color:#00796b;text-transform:uppercase;font-weight:900;letter-spacing:.02em;font-size:13px;">${config.eyebrow}</p>
                  <h1 style="margin:0 0 12px;font-size:42px;line-height:1;color:#111815;">${config.title}</h1>
                  <p style="margin:0;color:#5f6964;font-size:17px;line-height:1.6;">${config.intro}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:0 32px 24px;">
                  <div style="padding:18px;border:1px solid #e2e5df;border-radius:12px;background:#fbfcfb;">
                    <p style="margin:0 0 6px;color:#00796b;font-weight:900;text-transform:uppercase;font-size:12px;">Order ID</p>
                    <strong style="font-size:22px;color:#111815;">${escapeHtml(order.id)}</strong>
                    <p style="margin:8px 0 0;color:#6b746f;">Order Time: ${escapeHtml(createdAt)}</p>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:0 32px 24px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="padding:14px;border:1px solid #e2e5df;border-radius:10px;background:#fff;">
                        <p style="margin:0 0 4px;color:#00796b;font-weight:900;text-transform:uppercase;font-size:12px;">Customer Name</p>
                        <strong>${escapeHtml(order.customerName)}</strong>
                      </td>
                    </tr>
                    <tr><td style="height:10px;"></td></tr>
                    <tr>
                      <td style="padding:14px;border:1px solid #e2e5df;border-radius:10px;background:#fff;">
                        <p style="margin:0 0 4px;color:#00796b;font-weight:900;text-transform:uppercase;font-size:12px;">Email ID</p>
                        <strong>${escapeHtml(order.email)}</strong>
                      </td>
                    </tr>
                    <tr><td style="height:10px;"></td></tr>
                    <tr>
                      <td style="padding:14px;border:1px solid #e2e5df;border-radius:10px;background:#fff;">
                        <p style="margin:0 0 4px;color:#00796b;font-weight:900;text-transform:uppercase;font-size:12px;">Phone</p>
                        <strong>${escapeHtml(order.phone)}</strong>
                      </td>
                    </tr>
                    <tr><td style="height:10px;"></td></tr>
                    <tr>
                      <td style="padding:14px;border:1px solid #e2e5df;border-radius:10px;background:#fff;">
                        <p style="margin:0 0 4px;color:#00796b;font-weight:900;text-transform:uppercase;font-size:12px;">Address</p>
                        <span style="color:#5f6964;line-height:1.5;">${escapeHtml(order.address)}</span>
                      </td>
                    </tr>
                    <tr><td style="height:10px;"></td></tr>
                    <tr>
                      <td style="padding:14px;border:1px solid #e2e5df;border-radius:10px;background:#fff;">
                        <p style="margin:0 0 4px;color:#00796b;font-weight:900;text-transform:uppercase;font-size:12px;">Payment Screenshot</p>
                        <strong>${screenshotText}</strong>
                      </td>
                    </tr>
                    <tr><td style="height:10px;"></td></tr>
                    <tr>
                      <td style="padding:14px;border:1px solid #e2e5df;border-radius:10px;background:#fff;">
                        <p style="margin:0 0 4px;color:#00796b;font-weight:900;text-transform:uppercase;font-size:12px;">UTR Number</p>
                        <strong>${paymentUtr}</strong>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:0 32px 30px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e5df;border-radius:12px;padding:8px 16px;background:#fff;">
                    ${orderItemsHtml(order)}
                    <tr>
                      <td style="padding:16px 0 6px;font-size:18px;">Total</td>
                      <td style="padding:16px 0 6px;text-align:right;font-size:20px;font-weight:900;">${formatPrice(order.total || 0)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

async function sendResendEmail({ apiKey, from, to, subject, html, attachments }) {
  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      attachments
    })
  });

  const result = await resendResponse.json().catch(() => ({}));
  return {
    ok: resendResponse.ok,
    status: resendResponse.status,
    result
  };
}

function waitForSmtp(socket) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const onData = (chunk) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const lastLine = lines.at(-1);
      if (lastLine && /^\d{3} /.test(lastLine)) {
        socket.off("data", onData);
        resolve(buffer);
      }
    };
    socket.on("data", onData);
    socket.once("error", reject);
  });
}

async function smtpCommand(socket, command, expectedCodes) {
  socket.write(`${command}\r\n`);
  const response = await waitForSmtp(socket);
  const code = Number(response.slice(0, 3));
  if (!expectedCodes.includes(code)) {
    throw new Error(`SMTP ${command.split(" ")[0]} failed: ${response}`);
  }
  return response;
}

async function sendGmailSmtpEmail({ user, appPassword, from, to, subject, html, attachments }) {
  const requestedFromAddress = parseEmailAddress(from);
  const safeFrom = requestedFromAddress === user ? from : `Freaking Collectibles <${user}>`;
  const socket = tls.connect(465, "smtp.gmail.com", { servername: "smtp.gmail.com" });

  try {
    await new Promise((resolve, reject) => {
      socket.once("secureConnect", resolve);
      socket.once("error", reject);
    });
    await waitForSmtp(socket);
    await smtpCommand(socket, "EHLO localhost", [250]);
    await smtpCommand(socket, "AUTH LOGIN", [334]);
    await smtpCommand(socket, Buffer.from(user).toString("base64"), [334]);
    await smtpCommand(socket, Buffer.from(appPassword.replaceAll(" ", "")).toString("base64"), [235]);
    await smtpCommand(socket, `MAIL FROM:<${user}>`, [250]);
    await smtpCommand(socket, `RCPT TO:<${to}>`, [250, 251]);
    await smtpCommand(socket, "DATA", [354]);
    socket.write(`${buildMimeEmail({ from: safeFrom, to, subject, html, attachments })}\r\n.\r\n`);
    const dataResponse = await waitForSmtp(socket);
    const dataCode = Number(dataResponse.slice(0, 3));
    if (dataCode !== 250) {
      throw new Error(`SMTP DATA failed: ${dataResponse}`);
    }
    await smtpCommand(socket, "QUIT", [221]);
    return { ok: true };
  } catch (error) {
    socket.destroy();
    return { ok: false, result: { message: error.message } };
  }
}

export async function POST(request) {
  const apiKey = process.env.RESEND_API_KEY;
  const smtpUser = process.env.SMTP_USER;
  const smtpAppPassword = process.env.SMTP_APP_PASSWORD;
  const adminEmail = process.env.ADMIN_ORDER_EMAIL;
  const from = process.env.FROM_EMAIL || "Freaking Collectibles <onboarding@resend.dev>";

  if ((!smtpUser || !smtpAppPassword) && !apiKey) {
    return NextResponse.json({ error: "Email env missing" }, { status: 500 });
  }

  if (!adminEmail) {
    return NextResponse.json({ error: "Admin email missing" }, { status: 500 });
  }

  const { action, order } = await request.json();
  const config = ACTION_CONFIG[action];

  if (!config || !order?.id) {
    return NextResponse.json({ error: "Invalid email request" }, { status: 400 });
  }

  const to = config.toAdmin ? adminEmail : order.email;
  if (!to) {
    return NextResponse.json({ error: "Recipient missing" }, { status: 400 });
  }

  const subject = config.subject(order);
  const html = buildHtml(action, order);
  const attachments = paymentAttachment(order);
  const sendEmail = smtpUser && smtpAppPassword
    ? (payload) => sendGmailSmtpEmail({ user: smtpUser, appPassword: smtpAppPassword, ...payload })
    : (payload) => sendResendEmail({ apiKey, ...payload });

  const primary = await sendEmail({ from, to, subject, html, attachments });

  let adminCopy = null;
  if (!config.toAdmin && adminEmail && adminEmail !== order.email) {
    adminCopy = await sendEmail({
      from,
      to: adminEmail,
      subject: `Admin copy - ${subject}`,
      html,
      attachments
    });
  }

  if (!primary.ok) {
    return NextResponse.json({ error: "Email failed", detail: primary.result, adminCopy }, { status: 502 });
  }

  return NextResponse.json({ ok: true, result: primary.result, adminCopy });
}
