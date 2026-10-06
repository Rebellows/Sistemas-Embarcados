const MAX_PONTOS = 30;
const MAX_PONTOS_ROTA = 120; 

const estado = {
  G7: { contador: 0, pitch: [], altitude: [], velocidade: [], rota: [], distancia: 0, finalizado: false },
  G8: { contador: 0, pitch: [], altitude: [], velocidade: [], rota: [], distancia: 0, finalizado: false }
};

const ROTA_KM = 6;
const ROTA_METADE_KM = ROTA_KM / 2;

const cores = {
  G7: 'rgba(15, 51, 118, 1)',   
  G8: 'rgba(244, 67, 54, 1)'  
};

let charts = {}; // { altitude: Chart, velocidade: Chart, pitch: Chart }
let colisaoDetectada = false;

function atualiza_hora() {
  const el = document.getElementById('dia_hora');
  if (el) el.textContent = new Date().toLocaleTimeString('pt-BR');
}

function atualizaCard(grupo, valores) {
  const statusEl = document.getElementById(`status-${grupo}`);
  if (statusEl) {
    statusEl.textContent = 'conectado';
    statusEl.className = 'status conectado';
  }
  const setar = (campo, valor) => {
    const el = document.getElementById(`${campo}-${grupo}`);
    if (el) el.textContent = valor;
  };
  setar('pitch', valores.pitch);
  setar('altitude', valores.altitude);
  setar('velocidade', valores.velocidade);
  setar('distancia', valores.distanciaPercorrida);
}

function criaOuAtualizaGrafico(chaveGrafico, canvasId, campo, titulo) {
  const datasets = ['G7', 'G8'].map((grupo) => ({
    label: grupo === 'G7' ? 'Aviao Real (G7)' : 'Aviao Simulado (G8)',
    borderColor: cores[grupo],
    backgroundColor: cores[grupo],
    data: estado[grupo][campo].slice(),
    fill: false,
    tension: 0.2,
    pointRadius: 2
  }));

  if (charts[chaveGrafico]) {
    charts[chaveGrafico].data.datasets = datasets;
    charts[chaveGrafico].update('none');
    return;
  }

  charts[chaveGrafico] = new Chart(document.getElementById(canvasId), {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false, // sem isso, o canvas cresce sem limite dentro de um container sem altura fixa
      parsing: false, // os dados ja vem como {x, y}
      scales: {
        x: { type: 'linear', title: { display: true, text: 'amostra' } },
        y: { title: { display: true, text: titulo } }
      },
      plugins: { title: { display: true, text: titulo } }
    }
  });
}

function verificaSeparacao() {
  const banner = document.getElementById('separacao');
  const texto = document.getElementById('separacao-texto');
  if (!banner || !texto) return;

  const altG7 = estado.G7.altitude.length ? estado.G7.altitude[estado.G7.altitude.length - 1].y : null;
  const altG8 = estado.G8.altitude.length ? estado.G8.altitude[estado.G8.altitude.length - 1].y : null;

  if (altG7 === null || altG8 === null) {
    banner.className = 'separation-banner aguardando';
    texto.textContent = 'Aguardando dados dos dois avioes...';
    return;
  }

  const posG7 = calculaPosicao('G7');
  const posG8 = calculaPosicao('G8');

  const horizM = Math.abs(posG7 - posG8) * 1000; 

  const vertM = Math.abs(altG7 - altG8);

  const AVIAO_TAMANHO_M = 75;
  const ALTITUDE_COLISAO_M = 15;

  if (horizM < AVIAO_TAMANHO_M && vertM < ALTITUDE_COLISAO_M) {
    colisaoDetectada = true;
  }

  if (colisaoDetectada) {
    banner.className = 'separation-banner colisao';
    texto.textContent = `COLISAO - os avioes ocupam a mesma posicao (${posG7.toFixed(2)} km / ${altG7.toFixed(0)} m)`;
    return;
  }

  const separacao = vertM;

  if (separacao <= 100) {
    banner.className = 'separation-banner risco';
    texto.textContent = `RISCO DE COLISAO - separacao vertical de ${separacao.toFixed(0)}m`;
  } else if (separacao < 200) {
    banner.className = 'separation-banner atencao';
    texto.textContent = `Atencao - separacao vertical de ${separacao.toFixed(0)}m`;
  } else {
    banner.className = 'separation-banner seguro';
    texto.textContent = `Separacao segura - ${separacao.toFixed(0)}m entre os avioes`;
  }
}

function calculaPosicao(grupo) {
  const d = Math.min(estado[grupo].distancia / 1000, ROTA_KM); 
  return grupo === 'G7' ? -ROTA_METADE_KM + d : ROTA_METADE_KM - d;
}

function registraPosicaoNaRota(grupo) {
  if (estado[grupo].finalizado) return;
  estado[grupo].rota.push({
    x: calculaPosicao(grupo),
    y: estado[grupo].altitude[estado[grupo].altitude.length - 1].y
  });
  if (estado[grupo].rota.length > MAX_PONTOS_ROTA) estado[grupo].rota.shift();
}

function criaOuAtualizaMapa() {
  const canvasId = 'chart-mapa';
  let posG7 = calculaPosicao('G7');
  let posG8 = calculaPosicao('G8');

  const datasets = [
    {
      label: 'Aviao Real (G7)',
      borderColor: cores.G7,
      backgroundColor: cores.G7,
      data: estado.G7.rota.slice(),
      showLine: true,
      tension: 0.2,
      pointRadius: (context) => context.dataIndex === context.dataset.data.length - 1 ? 10 : 2,
      pointStyle: 'triangle',
      rotation: 90 // aponta pra direita, sentido do voo do G7
    },
    {
      label: 'Aviao Simulado (G8)',
      borderColor: cores.G8,
      backgroundColor: cores.G8,
      data: estado.G8.rota.slice(),
      showLine: true,
      tension: 0.2,
      pointRadius: (context) => context.dataIndex === context.dataset.data.length - 1 ? 10 : 2,
      pointStyle: 'triangle',
      rotation: 270 // aponta pra esquerda, sentido do voo do G8
    }
  ];

  if (charts.mapa) {
    charts.mapa.data.datasets = datasets;
    charts.mapa.update('none');
    return;
  }

  charts.mapa = new Chart(document.getElementById(canvasId), {
    type: 'scatter',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          min: -ROTA_METADE_KM,
          max: ROTA_METADE_KM,
          title: { display: true, text: 'posicao na rota (km)' }
        },
        y: {
          title: { display: true, text: 'altitude (m)' }
        }
      },
      plugins: {
        title: {
          display: true,
          text: 'Posicao na Rota - altitude durante o cruzamento'
        },
        legend: { position: 'bottom' }
      }
    }
  });
}

function registraDado(grupo, valores) {
  if (colisaoDetectada) return;

  const s = estado[grupo];
  const distancia = Number(valores.distanciaPercorrida);
  if (!Number.isFinite(distancia) || distancia < s.distancia) return;
  const x = s.contador++;

  s.pitch.push({ x, y: valores.pitch });
  s.altitude.push({ x, y: valores.altitude });
  s.velocidade.push({ x, y: valores.velocidade });
  s.distancia = Math.min(distancia, ROTA_KM * 1000);

  if (s.pitch.length > MAX_PONTOS) s.pitch.shift();
  if (s.altitude.length > MAX_PONTOS) s.altitude.shift();
  if (s.velocidade.length > MAX_PONTOS) s.velocidade.shift();

  atualizaCard(grupo, valores);
  registraPosicaoNaRota(grupo);
  s.finalizado = s.distancia >= ROTA_KM * 1000;

  criaOuAtualizaGrafico('altitude', 'chart-altitude', 'altitude', 'Altitude (m)');
  criaOuAtualizaGrafico('velocidade', 'chart-velocidade', 'velocidade', 'Velocidade (km/h)');
  criaOuAtualizaGrafico('pitch', 'chart-pitch', 'pitch', 'Pitch (graus)');
  criaOuAtualizaMapa();

  verificaSeparacao();
}
