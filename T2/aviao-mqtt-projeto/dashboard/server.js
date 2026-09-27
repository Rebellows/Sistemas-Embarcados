// So serve os arquivos estaticos (html/js/css). Toda a logica de MQTT roda
// no navegador (public/main.js), nao aqui no servidor, igual ao padrao do
// material da disciplina (mqtt.min.js rodando direto na webview).

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(PORT, () => {
  console.log(`Dashboard disponivel em http://localhost:${PORT}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`A porta ${PORT} ja esta em uso. Use o dashboard que ja esta rodando ou escolha outra porta com PORT=3001.`);
    process.exitCode = 1;
    return;
  }

  console.error('Erro ao iniciar o dashboard:', error.message);
  process.exitCode = 1;
});
