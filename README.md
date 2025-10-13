# Break Timer - Electron Tray App

Aplicación Electron que se ejecuta en la bandeja del sistema y lanza breaks automáticos cada 30 minutos.

## 🚀 Características

- ✅ App que vive únicamente en la bandeja del sistema (sin ventana visible)
- ✅ Timer automático cada 30 minutos (configurable)
- ✅ Break de 120 segundos (configurable)
- ✅ Menú contextual en tray: Pause for 1 hour, Settings..., Quit
- ✅ Configuración persistida en JSON (`app.getPath('userData')`)
- ✅ Canal IPC `break:start` para eventos de break
- ✅ Manejo robusto de suspensión del sistema
- ✅ Build para Windows con instalador NSIS

## 🛠️ Desarrollo

### Prerrequisitos

- Node.js 20+
- npm o yarn

### Instalación

```bash
# Instalar dependencias
npm install

# Desarrollar
npm run dev

# Build
npm run build

# Crear instalador
npm run dist
```

### Scripts Disponibles

- `npm run dev` - Compila TypeScript y ejecuta Electron
- `npm run build` - Compila TypeScript a JavaScript
- `npm run dist` - Crea el instalador (.exe) usando electron-builder
- `npm run lint` - Ejecuta ESLint
- `npm run lint:fix` - Ejecuta ESLint y corrige errores automáticamente

## 🏗️ Arquitectura

```
src/
├── main.ts        # Punto de entrada principal de Electron
├── log.ts         # Utilidades de logging consistente
├── settings.ts    # Gestión de configuración persistida
├── scheduler.ts   # Timer robusto con manejo de suspensión
└── tray.ts        # Icono y menú de bandeja del sistema
```

### Módulos Principales

- **SettingsManager**: Maneja configuración en JSON con validación
- **BreakScheduler**: Timer con setInterval + powerMonitor para suspensión
- **TrayManager**: Icono en bandeja con menú contextual
- **Logger**: Logging consistente con timestamps

## 🧪 Testing

Para probar rápidamente (bajar intervalos):

1. Modificar `src/settings.ts` - cambiar `DEFAULT_SETTINGS`
2. O usar las APIs IPC para cambiar settings en runtime

### Eventos IPC

- `break:start` - Emitido cuando inicia un break
- `get-settings` - Obtener configuración actual
- `save-settings` - Guardar nueva configuración
- `get-scheduler-status` - Estado del scheduler
- `pause-scheduler` - Pausar por 1 hora

### Logs en Consola

La app emite logs detallados:
- Inicio/apagado del scheduler
- Breaks triggered
- Cambios de configuración
- Eventos de suspensión del sistema

## 📦 Build y Distribución

### Crear Instalador

```bash
npm run dist
```

Esto genera:
- `dist-installer/Break Timer Setup X.X.X.exe` - Instalador NSIS para Windows

### Configuración de Build

La configuración está en `package.json` bajo la sección `build`:
- App ID: `com.thewayofcode.break-timer`
- Formato: NSIS installer
- Arquitectura: x64

## 🔧 Configuración

### Settings por Defecto

```json
{
  "intervalMinutes": 30,
  "breakSeconds": 120
}
```

### Ubicación de Settings

`%APPDATA%\\Break Timer\\settings.json`

## 🎯 Próximos Pasos

- [ ] Ventana de overlay durante breaks
- [ ] Interfaz de configuración completa
- [ ] Notificaciones del sistema
- [ ] Estadísticas de uso
- [ ] Temas y personalización

## 📋 Requisitos Cumplidos

- ✅ Electron + TypeScript + electron-builder
- ✅ App en tray sin ventana visible
- ✅ Timer cada 30' con break de 120s
- ✅ Menú tray con pausa y settings
- ✅ Settings persistidos
- ✅ IPC break:start
- ✅ Build genera .exe
- ✅ TypeScript strict
- ✅ ESM consistente
- ✅ Manejo de suspensión

## 🐛 Troubleshooting

### La app no aparece en tray
- Verificar logs en consola durante `npm run dev`
- Revisar que no haya errores de compilación TypeScript

### Settings no se guardan
- Verificar permisos de escritura en `%APPDATA%\\Break Timer\\`
- Revisar logs para errores de file system

### Timer no funciona
- Verificar que el scheduler esté inicializado en logs
- Comprobar que no esté pausado
