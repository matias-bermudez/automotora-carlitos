import { config } from './config.js';
import { priceLabel } from './format.js';

// Todas las consultas del sitio terminan en un link wa.me con el mensaje ya escrito.
export function waLink(text, number = config.whatsappNumber) {
  const base = 'https://wa.me/' + number;
  return text ? base + '?text=' + encodeURIComponent(text) : base;
}

// 59891969322 → "091 969 322"
export function displayPhone(number = config.whatsappNumber) {
  const local = number.startsWith('598') ? '0' + number.slice(3) : number;
  return local.replace(/^(\d{3})(\d{3})(\d+)$/, '$1 $2 $3');
}

export function telLink(number = config.whatsappNumber) {
  return 'tel:+' + number;
}

export function carTitle(car) {
  return `${car.brand} ${car.model} ${car.year}`;
}

export function carInterestMessage(car, url) {
  const price = car.price ? ` (${priceLabel(car.price)})` : '';
  return `Hola! Me interesa el ${carTitle(car)}${price} que vi en la web. ¿Sigue disponible?\n${url}`;
}

export function carVisitMessage(car, url) {
  return `Hola! Quiero coordinar una visita para ver el ${carTitle(car)}.\n${url}`;
}

export function soldCarMessage(car, url) {
  return `Hola! Vi que el ${carTitle(car)} ya se vendió. ¿Tienen algo parecido?\n${url}`;
}
