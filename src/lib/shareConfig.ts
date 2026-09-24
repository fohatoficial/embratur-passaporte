/** Domínio publicado usado no QR Code — único lugar a alterar. */
export const PUBLIC_SHARE_ORIGIN = "https://totempassportefit.lovable.app";

export const SHARE_BUCKET = "visitor-social-photos";
export const SHARE_TTL_HOURS = 24;

export const shareUrlFor = (token: string) => `${PUBLIC_SHARE_ORIGIN}/mi-foto/${token}`;

/** token opaco: 32 bytes em base64url (43 caracteres) */
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
