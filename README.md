# Brain Racers — TOEIC Edition

Juego de vocabulario TOEIC multijugador online para 2–4 participantes. Usa el glosario `Word Bank` del archivo original: 170 entradas. Las partidas tienen 10 rondas, 18 segundos por ronda y puntuación con bonus por rapidez.

## Requisitos
- Node.js 18 o superior
- npm

## Ejecutar localmente
```bash
npm install
npm start
```
Abre `http://localhost:3000` en el navegador. Para jugar desde distintos dispositivos, todos deben acceder a la misma dirección pública (ver despliegue).

## Publicar online (Render)
1. Sube esta carpeta a un repositorio GitHub.
2. En Render, crea un **Web Service** conectado al repositorio.
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Selecciona un plan que permita conexiones WebSocket persistentes.
6. Cuando Render entregue la URL HTTPS, compártela con todos los jugadores. Un jugador crea la sala y comparte el código de 5 dígitos.

También funciona en Railway, Fly.io o cualquier host Node.js que admita WebSockets. No es un juego alojado por este paquete: hay que desplegar el servidor para obtener una URL pública.

## Cómo jugar
1. Cada participante abre la misma URL desde su dispositivo.
2. Introduce un apodo y crea una sala o introduce el código de sala.
3. El anfitrión espera a que se unan de 1 a 3 jugadores más y pulsa **Iniciar carrera**.
4. Todos reciben las mismas 10 preguntas en tiempo real. Cada ronda dura hasta 18 segundos.
5. Cada acierto suma 100 puntos más un bonus de rapidez de hasta 54 puntos.
6. Al final se muestra la clasificación. El anfitrión puede iniciar una revancha.

## Datos y mecánicas
- `public/words.json` contiene las 170 entradas extraídas del Word Bank del XLSX.
- Preguntas de definición → palabra, español → palabra y sinónimos → término.
- Los sinónimos se usan únicamente cuando el glosario incluye términos concretos; los textos de advertencia del glosario no se tratan como sinónimos.
- La columna de ejemplos del archivo está vacía, así que el juego no inventa frases de ejemplo.
- El campo de pronunciación se conserva en el banco exportado, pero no se usa como respuesta automática.

## Alcance / limitaciones
- Multijugador online real mediante Socket.IO y servidor Node.js. El estado de las salas vive en memoria del proceso: si el servicio se reinicia, las salas activas se pierden.
- No hay cuentas, chat, base de datos ni persistencia histórica.
- La sala admite máximo 4 jugadores y requiere al menos 2 para empezar.
- Para producción con múltiples instancias, añadir un adaptador Socket.IO compartido (por ejemplo Redis) y almacenamiento persistente.
