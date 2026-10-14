import nodemailer from "nodemailer";
import { env } from "../config/env.js";

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false,
});

async function sendMail(to: string, subject: string, html: string): Promise<void> {
  try {
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error("Email send failed:", err);
    if (env.NODE_ENV !== "development") {
      throw err;
    }
  }
}

export async function sendVerifyEmail(to: string, token: string): Promise<void> {
  const url = `${env.EMAIL_VERIFY_BASE_URL}?token=${encodeURIComponent(token)}`;
  if (env.NODE_ENV === "development") {
    console.log(`Verify email for ${to}: ${url}`);
  }
  await sendMail(
    to,
    "Confirme ton compte Matcha",
    `<p>Bienvenue sur Matcha.</p>
     <p>Clique sur ce lien pour vérifier ton adresse e-mail :</p>
     <p><a href="${url}">${url}</a></p>
     <p>Si tu n'as pas créé de compte, ignore cet e-mail.</p>`,
  );
}

export async function sendResetEmail(to: string, token: string): Promise<void> {
  const url = `${env.PASSWORD_RESET_BASE_URL}?token=${encodeURIComponent(token)}`;
  if (env.NODE_ENV === "development") {
    console.log(`Reset password for ${to}: ${url}`);
  }
  await sendMail(
    to,
    "Réinitialise ton mot de passe Matcha",
    `<p>Tu as demandé une réinitialisation de mot de passe.</p>
     <p>Clique sur ce lien (valide 1 heure) :</p>
     <p><a href="${url}">${url}</a></p>
     <p>Si tu n'es pas à l'origine de cette demande, ignore cet e-mail.</p>`,
  );
}

export async function sendEmailChangedEmail(to: string, token: string): Promise<void> {
  const url = `${env.EMAIL_VERIFY_BASE_URL}?token=${encodeURIComponent(token)}`;
  if (env.NODE_ENV === "development") {
    console.log(`Re-verify email for ${to}: ${url}`);
  }
  await sendMail(
    to,
    "Confirme ta nouvelle adresse Matcha",
    `<p>Tu as modifié ton adresse e-mail.</p>
     <p>Clique pour la confirmer :</p>
     <p><a href="${url}">${url}</a></p>`,
  );
}
