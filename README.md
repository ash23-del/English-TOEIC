# Brain Racers — TOEIC Edition (Study + Multiplayer)

Aplicación web educativa con modo Study de flashcards y carreras generales multijugador online para 2–4 jugadores.

## Funciones
- **Study Mode:** tarjetas reversibles con palabra, pronunciación, definición y traducción. Filtros Todas / Por repasar / Dominadas. El progreso se guarda localmente en el navegador.
- **Carrera general:** 10 preguntas aleatorias del glosario TOEIC completo, con 18 segundos por ronda y bonus por rapidez. El archivo de vocabulario no contiene una clasificación fiable por niveles, por eso se usa una carrera general en lugar de inventar niveles.
- **Salir:** botón visible en la sala de espera y durante la carrera. El jugador abandona la sala y vuelve al menú; si era anfitrión, el servidor transfiere el anfitrión a otro jugador conectado.
- Salas reales con Socket.IO, código de 5 dígitos y hasta 4 participantes.

## Ejecutar localmente
Requiere Node.js 18 o superior.

```bash
npm install
npm start
```
Abre http://localhost:3000.

## Desplegar en Render
- Environment: Node
- Root Directory: vacío si `package.json` está en la raíz del repositorio
- Build Command: `npm install`
- Start Command: `npm start`

Sube todos los archivos y carpetas manteniendo esta estructura:

```text
package.json
server.js
public/
  index.html
  app.js
  style.css
  words.json
```

El modo Study guarda las listas de repaso en el almacenamiento local del navegador de cada participante. Las salas multijugador funcionan en tiempo real mediante Socket.IO. En el plan gratuito de Render, el servicio puede tardar en despertar tras inactividad.
