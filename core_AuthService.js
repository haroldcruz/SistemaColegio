/**
 * @file AuthService.gs
 * @description Funciones de autenticación y recuperación de usuario.
 */

/**
 * Busca y recupera la información de un usuario desde la hoja de cálculo 'Usuarios'.
 * @param {string} email El correo electrónico del usuario a buscar.
 * @returns {object|null} Un objeto con las propiedades del usuario (email, nombre, rol, acceso)
 * si se encuentra, o null si el usuario no existe en la hoja.
 */
function obtenerUsuario(email) {
  const ss = SpreadsheetApp.openById('1qJ96eOOfNxegq7GF_GdoH92bTiQuLLX51G1SGf3NoHI');
  const hoja = ss.getSheetByName('Usuarios');
  if (!hoja) return null;
  const datos = hoja.getDataRange().getValues();
   Logger.log("carga algo:"+ JSON.stringify(datos))
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][0] && String(datos[i][0]).toLowerCase() === email.toLowerCase()) {
      return {
        email: datos[i][0],
        nombre: datos[i][1],
        rol: datos[i][2],
        acceso: String(datos[i][3] || '').split(',').map(e => e.trim())
      };
    }
  }
  return null;
}
