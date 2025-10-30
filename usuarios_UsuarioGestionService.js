/**
 * @file UsuarioGestionService.gs
 * @description Funciones del servidor para el módulo de Gestión de Usuarios.
 */

const HOJA_USUARIOS_NOMBRE = 'Usuarios';
/**
 * Añade un nuevo usuario, gestionando la información en las hojas 'Usuarios' y 'Encargados'.
 *
 * @param {Object} data - Objeto con las propiedades del usuario (email, nombre, rol)
 * y los datos adicionales del Encargado.
 * @returns {object} Un objeto de resultado que indica éxito o fracaso.
 */
function incluirUsuario(data) {
  const { email, nombre, rol, datosAdicionales } = data;
  
  const hojaUsuarios = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Usuarios');
  const hojaEncargados = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Encargados');

  // --- 1. Verificación de Permisos ---
  const usuarioActual = obtenerUsuario(Session.getActiveUser().getEmail());
  if (!usuarioActual || usuarioActual.rol !== 'Administrador') {
    return { success: false, message: 'Acceso denegado. Solo los administradores pueden añadir usuarios.' };
  }
  
  // --- 2. Validar que el Email NO exista en la hoja de Usuarios ---
  const lastRowUsuarios = hojaUsuarios.getLastRow();
  let emailsExistentes = [];
  if (lastRowUsuarios > 1) {
    emailsExistentes = hojaUsuarios.getRange(2, 1, lastRowUsuarios - 1, 1).getValues().flat();
  }
  if (emailsExistentes.includes(email)) {
    return { success: false, message: `Ya existe un usuario con el email ${email}.` };
  }
  
  // --- 3. Procesar y guardar datos del Encargado (si aplica) ---
  if (rol === 'Encargado') {
    const { id, telefono } = datosAdicionales;
    
    // Nueva validación: Asegurar que el ID del encargado no esté vacío.
    if (!id || id.trim() === '') {
      return { success: false, message: 'El ID del encargado no puede estar vacío.' };
    }

    // Validar que el ID del Encargado NO exista en la hoja de Encargados.
    const lastRowEncargados = hojaEncargados.getLastRow();
    let idsExistentes = [];
    if (lastRowEncargados > 1) {
      idsExistentes = hojaEncargados.getRange(2, 1, lastRowEncargados - 1, 1).getValues().flat();
    }
    
    // Convertir a cadena de texto para una comparación segura
    const idString = String(id).trim(); 
    if (idsExistentes.map(String).includes(idString)) {
      return { success: false, message: `Ya existe un encargado con el ID ${id}.` };
    }
    
    // Guardar los datos específicos del Encargado en la hoja 'Encargados'
    const datosEncargado = [idString, nombre, email, telefono];
    hojaEncargados.appendRow(datosEncargado);
  }
  
  // --- 4. Guardar los datos generales del usuario en la hoja 'Usuarios' ---
  const datosUsuario = [email, nombre, rol, ''];
  hojaUsuarios.appendRow(datosUsuario);
  
  return { success: true, message: 'Usuario añadido exitosamente.' };
}
/**
 * Devuelve todos los usuarios registrados en la hoja 'Usuarios'.
 * No realiza validación de acceso ni depende del email actual.
 * Se utiliza para mostrar o exportar la lista completa de usuarios.
 *
 * @returns {Array<Object>} Un arreglo de objetos con las propiedades:
 * email, nombre, rol, acceso
 */
function obtenerTodoUsuarios() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hoja = ss.getSheetByName('Usuarios');
  if (!hoja) return [];

  const datos = hoja.getDataRange().getValues();
  const usuarios = [];

  for (let i = 1; i < datos.length; i++) {
    const fila = datos[i];
    if (!fila[0]) continue; // Ignora filas vacías

    usuarios.push({
      email: fila[0],
      nombre: fila[1],
      rol: fila[2],
      acceso: String(fila[3] || '').split(',').map(e => e.trim())
    });
  }

  return usuarios;
}
/**
 * Actualiza los datos de un usuario existente en la hoja de cálculo,
 * gestionando las actualizaciones en las hojas de 'Usuarios' o 'Encargados' según el rol.
 *
 * @param {Object} data - Objeto con los datos a actualizar.
 * @returns {object} Un objeto de resultado que indica éxito o fracaso.
 */
function actualizarUsuarioBackEnd(data) {
  const { originalEmail, nuevoNombre, nuevosAccesos, rol } = data;
  
  // 1. Verificación de permisos
  const usuarioActual = obtenerUsuario(Session.getActiveUser().getEmail());
  if (!usuarioActual || usuarioActual.rol !== 'Administrador') {
    return { success: false, message: 'Acceso denegado. Solo los administradores pueden editar usuarios.' };
  }
  
  // 2. Determinar la hoja de cálculo y las columnas a actualizar según el rol
  let hojaAActualizar;
  let nombreColumna, accesosColumna, emailColumna;

  if (rol === 'Encargado') {
    hojaAActualizar = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Encargados');
    // Las columnas en la hoja de Encargados son: ID, Nombre, Correo, Teléfono
    nombreColumna = 'Nombre';
    emailColumna = 'Correo';
    accesosColumna = null; // No existe en esta tabla
  } else {
    hojaAActualizar = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Usuarios');
    // Las columnas en la hoja de Usuarios son: Email, Nombre, Rol, Accesos
    nombreColumna = 'Nombre';
    emailColumna = 'Email';
    accesosColumna = 'Acceso';
  }

  const lastRow = hojaAActualizar.getLastRow();
  if (lastRow <= 1) {
    return { success: false, message: `No se encontró al usuario con el email ${originalEmail}.` };
  }
  
  // 3. Obtener todos los datos de la hoja de cálculo
  const datos = hojaAActualizar.getDataRange().getValues();
  const encabezados = datos[0];
  
  let filaIndex = -1;
  const emailIndex = encabezados.indexOf(emailColumna);

  if (emailIndex === -1) {
     return { success: false, message: `Error en la estructura de la hoja: Falta la columna "${emailColumna}".` };
  }

  // 4. Buscar la fila del usuario
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][emailIndex] === originalEmail) {
      filaIndex = i;
      break;
    }
  }

  if (filaIndex === -1) {
    return { success: false, message: `No se encontró al usuario con el email ${originalEmail}.` };
  }
  
  // 5. Encontrar los índices de las columnas a actualizar
  const nombreIndex = encabezados.indexOf(nombreColumna);
  
  if (nombreIndex === -1) {
    return { success: false, message: `Error en la estructura de la hoja: Falta la columna "${nombreColumna}".` };
  }
  
  const filaAActualizar = hojaAActualizar.getRange(filaIndex + 1, 1, 1, encabezados.length);
  const valoresFila = filaAActualizar.getValues()[0];
  
  // 6. Actualizar los datos de la fila
  valoresFila[nombreIndex] = nuevoNombre;
  
  if (accesosColumna) {
    const accesosIndex = encabezados.indexOf(accesosColumna);
    if (accesosIndex === -1) {
      return { success: false, message: `Error en la estructura de la hoja: Falta la columna "${accesosColumna}".` };
    }
    valoresFila[accesosIndex] = nuevosAccesos;
  }
  
  filaAActualizar.setValues([valoresFila]);
  
  return { success: true, message: 'Usuario actualizado exitosamente.' };
}