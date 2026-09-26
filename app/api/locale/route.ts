import { chooseLanguage } from '@/lib/i18n';
export function GET(request:Request){return Response.json({language:chooseLanguage(request.headers.get('x-vercel-ip-country')||request.headers.get('cf-ipcountry'),request.headers.get('accept-language'))},{headers:{'Cache-Control':'private, no-store','Vary':'Accept-Language, X-Vercel-IP-Country, CF-IPCountry'}})}
