# Opciones de Voz para Text-to-Speech (TTS)

Actualmente, "The Way of Code" usa **Google Translate TTS gratuito**, pero hay varias alternativas con más voces disponibles.

## 🎯 TTS Actual (Google Translate Gratuito)

**Ventajas:**
- ✅ Gratuito e ilimitado
- ✅ Sin configuración necesaria
- ✅ Funciona sin conexión a internet (solo para síntesis)

**Limitaciones:**
- ❌ Solo 1 voz por idioma (generalmente femenina)
- ❌ Calidad básica
- ❌ Idiomas limitados

**Idiomas disponibles:** ~25 idiomas principales
- Inglés (en), Español (es), Francés (fr), Alemán (de), Italiano (it), Portugués (pt)
- Japonés (ja), Coreano (ko), Chino (zh), Árabe (ar), Hindi (hi)
- Ruso (ru), Turco (tr), Polaco (pl), Holandés (nl), etc.

**Comando para probar:**
```bash
node scripts/test-tts-google-free.js "Hola, esta es una prueba"
```

**Comando para listar voces disponibles:**
```bash
node scripts/list-google-tts-voices.js
```

---

## 🚀 Opción 1: Google Cloud Text-to-Speech (Recomendado)

**Ventajas:**
- ✅ Calidad premium con voces neurales
- ✅ Múltiples voces por idioma (género, acento, edad)
- ✅ Más de 100 voces en 30+ idiomas
- ✅ Control total (velocidad, tono, énfasis)

**Desventajas:**
- ❌ Servicio pago ($16 por millón de caracteres después del free tier)
- ❌ Requiere credenciales de Google Cloud
- ❌ Necesita conexión a internet

### Voces Disponibles (Principales):

#### 🇺🇸 Inglés Americano (en-US)
- `en-US-Neural2-C` - Mujer, natural
- `en-US-Neural2-D` - Hombre, natural
- `en-US-Neural2-F` - Mujer, amigable
- `en-US-Standard-C` - Mujer, estándar
- `en-US-Standard-D` - Hombre, estándar
- `en-US-Standard-F` - Mujer, estándar

#### 🇪🇸 Español de España (es-ES)
- `es-ES-Neural2-A` - Mujer, clara
- `es-ES-Neural2-B` - Mujer, cálida
- `es-ES-Neural2-C` - Hombre, profesional
- `es-ES-Neural2-D` - Mujer, expresiva
- `es-ES-Neural2-E` - Mujer, juvenil
- `es-ES-Neural2-F` - Mujer, formal

#### 🇲🇽 Español de Estados Unidos (es-US)
- `es-US-Neural2-A` - Mujer, natural
- `es-US-Neural2-B` - Hombre, conversacional
- `es-US-Neural2-C` - Mujer, amigable

#### 🇫🇷 Francés (fr-FR)
- `fr-FR-Neural2-A` - Mujer, elegante
- `fr-FR-Neural2-B` - Hombre, profesional
- `fr-FR-Neural2-C` - Mujer, cálida
- `fr-FR-Neural2-D` - Hombre, narrativo
- `fr-FR-Neural2-E` - Mujer, expresiva

#### 🇩🇪 Alemán (de-DE)
- `de-DE-Neural2-A` - Mujer, clara
- `de-DE-Neural2-B` - Hombre, profesional
- `de-DE-Neural2-C` - Mujer, cálida
- `de-DE-Neural2-D` - Hombre, narrativo
- `de-DE-Neural2-F` - Mujer, juvenil

#### 🇯🇵 Japonés (ja-JP)
- `ja-JP-Neural2-B` - Mujer, natural
- `ja-JP-Neural2-C` - Hombre, profesional
- `ja-JP-Neural2-D` - Mujer, juvenil

#### 🇰🇷 Coreano (ko-KR)
- `ko-KR-Neural2-A` - Mujer, clara
- `ko-KR-Neural2-B` - Mujer, cálida
- `ko-KR-Neural2-C` - Hombre, profesional

#### 🇨🇳 Chino Mandarín (zh-CN)
- `zh-CN-Neural2-A` - Mujer, profesional
- `zh-CN-Neural2-B` - Mujer, cálida
- `zh-CN-Neural2-C` - Hombre, narrativo
- `zh-CN-Neural2-D` - Mujer, juvenil

### 🔧 Configuración de Credenciales

Para usar Google Cloud TTS, necesitas configurar las credenciales:

1. **Archivo de Service Account**: Coloca tu archivo JSON en `keys/the-way-of-code-a39c1f8438eb.json`
2. **Habilitar API**: Ve a [Google Cloud Console](https://console.cloud.google.com/apis/library/texttospeech.googleapis.com) y habilita Text-to-Speech API
3. **Permisos**: Asegúrate de que tu service account tenga permisos para Text-to-Speech API

**Comandos para usar:**
```bash
# Ver ejemplos de voces (sin credenciales)
node scripts/list-google-cloud-tts-voices.js examples

# Probar TTS con credenciales de service account
node scripts/test-tts-google-service-account.js "Hello world"

# Listar todas las voces disponibles (con credenciales)
node scripts/list-google-cloud-tts-voices-with-creds.js
```

---

## 🖥️ Opción 2: Voces de Windows (Gratuito, Sin Internet)

**Ventajas:**
- ✅ Completamente gratuito
- ✅ Sin configuración
- ✅ Funciona sin internet
- ✅ Voces neurales modernas en Windows 10/11

**Desventajas:**
- ❌ Solo disponible en Windows
- ❌ Menos idiomas que Google Cloud
- ❌ Calidad variable según instalación

### Tipos de Voces en Windows:

#### 📢 SAPI (System.Speech) - Básico
- Voces tradicionales incluidas con Windows
- Generalmente 1-2 voces por idioma instalado
- Calidad básica pero confiable

#### 🎯 Windows Runtime (WinRT) - Moderno
- Voces neurales de alta calidad (Windows 10/11)
- Múltiples voces por idioma
- Se instalan desde Configuración > Idioma > Voz

**Voces comunes disponibles:**
- Microsoft Zira Desktop (en-US, mujer)
- Microsoft David Desktop (en-US, hombre)
- Microsoft Hazel Desktop (en-GB, mujer)
- Microsoft Zira (en-US, mujer, mejor calidad)
- Microsoft Mark (en-US, hombre, mejor calidad)
- Voces en español: Microsoft Helena (es-ES), Microsoft Laura (es-ES), etc.

**Comando para listar voces de Windows:**
```powershell
# Ejecutar en PowerShell
.\scripts\list-windows-tts-voices.ps1

# O con texto personalizado
.\scripts\list-windows-tts-voices.ps1 "Hola, probando voces de Windows"
```

---

## 🔧 Implementación Actual

Para cambiar a un sistema de TTS diferente, se necesitaría:

1. **Modificar `src/overlay/OverlayManager.ts`** - Función `speakWithGoogleTts`
2. **Actualizar configuración** - Añadir opciones de voz en settings
3. **Añadir dependencias** - Para Google Cloud TTS o Windows TTS
4. **Actualizar UI** - Añadir selector de voz

### Configuración Sugerida:

```typescript
interface TtsConfig {
  provider: 'google-free' | 'google-cloud' | 'windows';
  voice?: string;
  language: string;
  speed?: number;
  pitch?: number;
}
```

---

## 💰 Costos y Recomendaciones

### Para Uso Personal:
- **Google Translate (actual)**: $0 - Suficiente para la mayoría
- **Windows TTS**: $0 - Buena opción si no necesitas muchos idiomas
- **Google Cloud**: $0-16/mes - Para calidad premium

### Para Distribución:
- **Google Translate**: Recomendado (sin costos, sin configuración)
- **Windows TTS**: Solo si es aplicación Windows-only
- **Google Cloud**: No recomendado (requiere credenciales de usuario)

---

## 🧪 Scripts de Prueba Disponibles

```bash
# Google Translate gratuito
node scripts/test-tts-google-free.js "Texto de prueba"

# Google Cloud (requiere credenciales)
node scripts/test-tts-google.js "Texto de prueba"

# Windows SAPI
.\scripts\test-tts-sapi.ps1 "Texto de prueba"

# Windows Runtime
.\scripts\test-tts-winrt.ps1 "Texto de prueba"

# Listar voces disponibles
node scripts/list-google-tts-voices.js
node scripts/list-google-cloud-tts-voices.js examples
.\scripts\list-windows-tts-voices.ps1
```

---

## 🎵 Calidad de Audio

1. **Google Cloud Neural2**: Mejor calidad (pago)
2. **Windows Neural Voices**: Muy buena calidad (gratis en Win10/11)
3. **Google Translate**: Calidad aceptable (gratis)
4. **Windows SAPI**: Calidad básica (gratis)

¿Te gustaría probar alguna de estas opciones o necesitas ayuda para implementar un cambio de TTS?
