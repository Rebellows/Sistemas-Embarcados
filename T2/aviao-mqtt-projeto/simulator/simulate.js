const mqtt = require('mqtt');

const BROKER  = 'mqtt://broker.emqx.io:1883';
const TOPICO  = process.env.TOPICO || 'Embarcados/G8';
const CLIENT_ID = 'sim_' + Math.random().toString(16).slice(2, 8); // precisa ser unico no broker

// Mesmos limites do memorial descritivo
const SPEED_MIN = 160, SPEED_MAX = 240;
const PITCH_MIN = -15, PITCH_MAX = 15;
const PUBLISH_INTERVAL_MS = 500;
const ENDPOINT_DISTANCE_M = 6000;

// Estado do aviao simulado (comeca igual ao real: 4000m, 200km/h)
let velocidade = 200;
let pitch = 0;
let altitude = 4000;
let distanciaPercorrida = 0;

// Random walk em vez de valor totalmente aleatorio a cada tick, para dar um
// aspecto mais real e nao deixar o aviao pulando
function randomStep(current, min, max, stepSize) {
  const delta = (Math.random() * 2 - 1) * stepSize; // entre -stepSize e +stepSize
  let next = current + delta;
  if (next < min) next = min;
  if (next > max) next = max;
  return next;
}

const client = mqtt.connect(BROKER, { clientId: CLIENT_ID });

client.on('connect', () => {
  console.log(`[${CLIENT_ID}] Conectado ao broker. Publicando em "${TOPICO}" a cada ${PUBLISH_INTERVAL_MS}ms.`);

  const timer = setInterval(() => {
    velocidade = randomStep(velocidade, SPEED_MIN, SPEED_MAX, 3);
    pitch      = randomStep(pitch, PITCH_MIN, PITCH_MAX, 1.5);

    const v_ms = velocidade * 1000 / 3600; // km/h -> m/s
    const dt   = PUBLISH_INTERVAL_MS / 1000;

    altitude            += v_ms * Math.sin(pitch * Math.PI / 180) * dt;
    distanciaPercorrida += v_ms * dt;
    const chegouAoDestino = distanciaPercorrida >= ENDPOINT_DISTANCE_M;
    if (chegouAoDestino) distanciaPercorrida = ENDPOINT_DISTANCE_M;

    const payload = JSON.stringify({
      pitch: Number(pitch.toFixed(1)),
      altitude: Math.round(altitude),
      velocidade: Math.round(velocidade),
      distanciaPercorrida: Math.round(distanciaPercorrida)
    });

    client.publish(TOPICO, payload);
    console.log(`[${CLIENT_ID}] Publicado: ${payload}`);

    if (chegouAoDestino) {
      clearInterval(timer);
      console.log(`[${CLIENT_ID}] Destino alcancado; simulacao encerrada.`);
    }
  }, PUBLISH_INTERVAL_MS);
});

client.on('error', (err) => {
  console.error('Erro de conexao MQTT:', err.message);
});
