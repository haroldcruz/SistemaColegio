/**
 * @file UtilsService.gs
 * @description Funciones auxiliares para la interfaz y recursos.
 */

/**
 * Incluye el contenido de otros archivos HTML dentro de un template.
 * @param {string} filename
 * @returns {string}
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Obtiene el escudo del colegio desde Google Drive y lo codifica en Base64.
 * @returns {string}
 */
function obtenerEscudo() {
  var fileId = '1vl1Fz1Ot6h112QO5UM0UywSKfWwNHXuO'; // Reemplaza con tu ID real
  var blob = DriveApp.getFileById(fileId).getBlob();
  return Utilities.base64Encode(blob.getBytes());
}
