// Conecta direto do navegador ao broker via WebSocket (wss, porta 8084 — porta
// 8083/ws sem criptografia se mostrou bloqueada em testes anteriores, entao
// ja fica direto na segura).

const BROKER = 'wss://broker.emqx.io:8084/mqtt';

// Mapeia topico -> grupo usado no restante da UI (funcoes.js).
// TROCAR aqui se o numero do grupo real ou do simulado mudar.
const TOPICOS = {
  'Embarcados/G1': 'G1', // aviao real (ESP32)
  'Embarcados/G2': 'G2'  // aviao simulado (Node.js)
};

const client = mqtt.connect(BROKER, {
  clientId: 'dashboard_' + Math.random().toString(16).slice(2, 8)
});

// Marca como "desconectado" se um dos avioes ficar mais de 5s sem publicar
// (ex: ESP32 desligado ou simulador parado), mesmo que o dashboard em si
// continue conectado ao broker normalmente.
const ultimoRecebido = { G1: 0, G2: 0 };
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
  ['G1', 'G2'].forEach((grupo) => {
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
