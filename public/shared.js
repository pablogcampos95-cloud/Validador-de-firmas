function renderValidation(data) {
  document.getElementById('ui-estado').textContent = data.estado;
  document.getElementById('ui-detalle-estado').textContent = data.estado;
  document.getElementById('ui-fecha').textContent = data.fechaValidacion;
  document.getElementById('ui-mensaje').textContent = data.mensajeIntegridad;
  document.getElementById('ui-firmante').textContent = data.firmante.nombre;
  document.getElementById('ui-fecha-firma').textContent = data.firmante.fechaFirma;
  document.getElementById('ui-nombre').textContent = data.firmante.nombre;
  document.getElementById('ui-cargo').textContent = data.firmante.cargo;
  document.getElementById('ui-empresa').textContent = data.firmante.empresa;
  document.getElementById('ui-algoritmo').textContent = data.firmante.algoritmo;
  document.getElementById('ui-tipo-firma').textContent = data.firmante.tipoFirma;
  document.getElementById('ui-serial').textContent = data.certificado.serial;
  document.getElementById('ui-valido-desde').textContent = data.certificado.validoDesde;
  document.getElementById('ui-valido-hasta').textContent = data.certificado.validoHasta;
  document.getElementById('ui-entidad').textContent = data.certificado.entidad;
  document.getElementById('ui-ruta').innerHTML = data.certificado.ruta
    .map((item) => `<p>${escapeHtml(item)}</p>`)
    .join('');
  document.getElementById('ui-sello').textContent = 'No se encontró sello de tiempo para esta firma.';
}

function setError(message) {
  const errorBox = document.getElementById('error-box');
  errorBox.textContent = message;
  errorBox.classList.toggle('visible', Boolean(message));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
