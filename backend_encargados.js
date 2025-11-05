/**
 * Devuelve la lista de encargados registrados para llenar el dropdown
 */
function getEncargadosData() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Encargados'); // nombre de tu hoja
    if (!sheet) throw new Error("Hoja 'Encargados' no encontrada");

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIndex = headers.indexOf("Cédula") !== -1 ? headers.indexOf("Cédula") : 0;
    const nombreIndex = headers.indexOf("Nombre") !== -1 ? headers.indexOf("Nombre") : 1;
    const apellido1Index = headers.indexOf("Primer apellido") !== -1 ? headers.indexOf("Primer apellido") : 2;
    const apellido2Index = headers.indexOf("Segundo apellido") !== -1 ? headers.indexOf("Segundo apellido") : 3;

    // Convierte filas en objetos simples para enviar al front
    const encargados = data.slice(1).map(row => {
      const nombreCompleto = [row[nombreIndex], row[apellido1Index], row[apellido2Index]]
        .filter(Boolean)
        .join(' ');
      return {
        id: row[idIndex] ? row[idIndex].toString().trim() : "",
        nombre: nombreCompleto.trim()
      };
    }).filter(e => e.id); // quita filas vacías

    return encargados;
  } catch (e) {
    Logger.log("Error en getEncargadosData: " + e.message);
    throw e;
  }
}
