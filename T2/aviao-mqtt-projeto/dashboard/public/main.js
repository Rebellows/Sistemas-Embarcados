const BROKER = 'wss://broker.emqx.io:8084/mqtt';

const TOPICOS = {
  'Embarcados/G7': 'G7', // aviao real (ESP32)
  'Embarcados/G8': 'G8'  // aviao simulado (Node.js)
};

const client = mqtt.connect(BROKER, {
  clientId: 'dashboard_' + Math.random().toString(16).slice(2, 8)
});

const ultimoRecebido = { G7: 0, G8: 0 };
const TIMEOUT_MS = 5000;

client.on('connect', () => {
  console.log('Conectado ao broker');
  Object.keys(TOPICOS).forEach((topico) => client.subscribe(topico));
});

client.on('message', (topico, mensagem) => {
  const grupo = TOPICOS[topico];
  if (!grupo) return; // mensagem de outro topico, ignora

  let valores;
  try {
    valores = JSON.parse(mensagem.toString());
  } catch (e) {
    console.error('Payload invalido em', topico, mensagem.toString());
    return;
  }

  ultimoRecebido[grupo] = Date.now();
  registraDado(grupo, valores);
});

client.on('error', (err) => {
  console.error('Erro MQTT:', err.message);
});

setInterval(() => {
  ['G7', 'G8'].forEach((grupo) => {
    if (ultimoRecebido[grupo] === 0) return; // ainda nao recebeu nada, deixa como esta
    const statusEl = document.getElementById(`status-${grupo}`);
    if (!statusEl) return;
    const semDados = Date.now() - ultimoRecebido[grupo] > TIMEOUT_MS;
    if (semDados) {
      statusEl.textContent = 'sem dados';
      statusEl.className = 'status desconectado';
    }
  });
}, 2000);

setInterval(atualiza_hora, 500);
