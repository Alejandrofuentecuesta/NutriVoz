# NutriVoz 🎤🥗

App de tracking de comida y ejercicio por voz. Todo local, sin servidores.

## Stack
- **Expo / React Native** — app nativa para Android e iOS
- **Whisper API (OpenAI)** — transcripción de voz
- **GPT-4o (OpenAI)** — extracción de macros y calorías
- **SQLite local** — todos los datos en tu móvil

## Instalación

### 1. Requisitos
- Node.js 18+
- npm o yarn
- Expo Go instalado en tu móvil (para desarrollo) o EAS CLI (para APK)

### 2. Instalar dependencias
```bash
npm install
```

### 3. Añadir tu API key de OpenAI
Edita `lib/openai.ts` y sustituye `sk-XXXXXXXX` con tu key real.

O mejor: en la app, ve a **Ajustes** y escribe tu API key ahí (se guarda localmente).

> ⚠️ La key de platform.openai.com es diferente a tu suscripción de ChatGPT.
> Crea una en https://platform.openai.com/api-keys y añade 5€ de crédito.

### 4. Ejecutar en desarrollo
```bash
npx expo start
```
Escanea el QR con Expo Go en tu móvil.

### 5. Generar APK para Android (sin cuenta de desarrollador)
```bash
npx expo install --fix
npx eas build -p android --profile preview
```
Necesitas cuenta gratuita en expo.dev.

## Uso

- **Hoy**: resumen de calorías y macros del día
- **Registrar**: mantén pulsado el botón de micro y habla. Ejemplos:
  - "Me he comido un bocadillo de jamón con tomate"
  - "He corrido 40 minutos esta mañana"
  - "Cena: ensalada, merluza al horno y fruta"
- **Historial**: gráfica de calorías de los últimos 7 días
- **Ajustes**: API key y objetivos diarios de macros

## Coste estimado API
- Whisper: ~$0.006/minuto de audio
- GPT-4o: ~$0.002 por entrada
- **Total: <0.01€ por registro** — prácticamente gratis para uso personal
