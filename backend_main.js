// -------------------------------------------------------------
// ID del Spreadsheet principal
// -------------------------------------------------------------
const SPREADSHEET_ID = '1qJ96eOOfNxegq7GF_GdoH92bTiQuLLX51G1SGf3NoHI'; // ❗ Mantén tu ID real

// -------------------------------------------------------------
// ENDPOINT PRINCIPAL (HTML)
// -------------------------------------------------------------
function doGet() {
  // Protege la ruta principal
  const userInfo = getUserRole();
  if (!userInfo.isAuthorized) {
    // Mensaje simple cuando no tiene acceso
    return HtmlService.createHtmlOutput('<div style="padding:24px;font-family:Arial;">Acceso restringido.</div>');
  }
  // Renderiza la página principal desde view_index
  return HtmlService.createTemplateFromFile('view_index').evaluate();
}

// -------------------------------------------------------------
// INCLUYE ARCHIVOS HTML
// -------------------------------------------------------------
function include(filename) {
  // Devuelve el contenido HTML de un archivo dado
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// -------------------------------------------------------------
// OBTIENE EL ESCUDO DEL DRIVE EN BASE64
// -------------------------------------------------------------
function obtenerEscudo() {
  const fileId = '1vl1Fz1Ot6h112QO5UM0UywSKfWwNHXuO';
  try {
    // Descarga el archivo y lo convierte a base64
    const blob = DriveApp.getFileById(fileId).getBlob();
    return Utilities.base64Encode(blob.getBytes());
  } catch (e) {
    Logger.log('Error al obtener el escudo: ' + e.toString());
    // Devuelve imagen transparente si falla
    return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  }
}

// -------------------------------------------------------------
// LEE DATOS DE UNA HOJA Y LOS DEVUELVE COMO ARRAY DE OBJETOS
// -------------------------------------------------------------
function getDataFromSheet(sheetName) {
  try {
    // Accede a la hoja y obtiene los valores
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
    if (!sheet) return [];
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return [];
    const headers = values[0];
    // Convierte cada fila en objeto con claves de encabezados
    return values.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h.toString().trim()] = row[i]);
      return obj;
    });
  } catch (e) {
    Logger.log(`Error al leer hoja ${sheetName}: ${e}`);
    return [];
  }
}

// -------------------------------------------------------------
// DEVUELVE INFORMACIÓN DEL USUARIO ACTIVO (ROL, EMAIL, ETC.)
// -------------------------------------------------------------
function getUserRole() {
  // Obtiene el email del usuario actual
  const userEmail = Session.getActiveUser().getEmail().toLowerCase().trim();
  const usersData = getDataFromSheet('Usuarios');
  // Busca el usuario por email
  const user = usersData.find(u => u.Email && u.Email.toString().toLowerCase().trim() === userEmail);

  // Si no existe, retorna valores por defecto
  if (!user) {
    return {
      name: userEmail ? userEmail.split('@')[0] : '',
      role: 'Sin Rol',
      email: userEmail,
      encargadoId: null,
      isAuthorized: false
    };
  }

  // Extrae rol y acceso (puede ser ID de encargado)
  const role = (user.Rol || '').toString().trim();
  const accessValue = user.Acceso ? user.Acceso.toString().trim() : null;
  const hasRole = role.length > 0;
  return {
    name: user.Nombre || userEmail.split('@')[0],
    role: role,
    email: userEmail,
    encargadoId: accessValue /* debería llamarse acceso, pero se mantiene para compatibilidad */,
    isAuthorized: hasRole
  };
}

// -------------------------------------------------------------
// DEVUELVE DATOS DEL DASHBOARD SEGÚN ROL Y ACCESO
// -------------------------------------------------------------
function getDashboardData(email) {
  const users = getDataFromSheet('Usuarios');
  const user = users.find(u => u.Email && u.Email.toString().toLowerCase().trim() === email);
  const role = user ? user.Rol.toString().toLowerCase().trim() : 'desconocido';

  // Admin y secretaria: totales simples
  if (role === 'administrador' || role === 'secretaria') {
    return {
      users: getDataFromSheet('Usuarios').length,
      students: getDataFromSheet('Estudiantes').length,
      subjects: getDataFromSheet('Materias').length,
      guardians: getDataFromSheet('Encargados').length,
      evaluations: getDataFromSheet('Evaluaciones').length,
      behavior: getDataFromSheet('Conducta').length,
      sections: getDataFromSheet('Secciones').length
    };
  }

  // Docente: filtra estudiantes por secciones
  if (role === 'docente' || role === 'profesor') {
    const acceso = user.Acceso ? user.Acceso.split(',').map(s => s.trim()) : [];
    const estudiantes = getDataFromSheet('Estudiantes').filter(e => 
      acceso.includes((e.Sección || "").toString().trim())
    );
    const clases = getDataFromSheet('Clase').filter(c => c.id_profesor && c.id_profesor.toString().toLowerCase().trim() === email);
    const materiaIds = [...new Set(clases.map(c => c.id_materia))];
    return {
      students: estudiantes.length,
      subjects: materiaIds.length,
      sections: acceso.length
    };
  }

  // Encargado/padre: filtra por correo
  const encargados = getDataFromSheet('Encargados');
  const encargadoEncontrado = encargados.find(e => {
    const correoEncargado = (e["Correo"] || "").toString().toLowerCase().trim();
    return correoEncargado === email;
  });
  if (!encargadoEncontrado || !encargadoEncontrado["ID"]) {
    return { students: 0, studentNames: [] };
  }
  const encargadoId = encargadoEncontrado["ID"].toString().trim();

  const studentsData = getDataFromSheet('Estudiantes');
  const myStudents = studentsData.filter(r => {
    const encId = (r["Encargado ID"] || r["Encargado_ID"] || r["EncargadoId"] || "").toString().trim();
    return encId === encargadoId;
  });
  return {
    students: myStudents.length,
    studentNames: myStudents.map(r => r["Nombre"])
  };
}
// -------------------------------------------------------------
// CARGA UN MÓDULO HTML POR NOMBRE DE ARCHIVO
// -------------------------------------------------------------
function loadModule(filename) {
  try {
    // Renderiza el archivo HTML solicitado
    return HtmlService.createTemplateFromFile(filename).evaluate().getContent();
  } catch (error) {
    // Devuelve mensaje de error si falla
    return `<div style="padding:20px;color:red;">Error al cargar el módulo ${filename}.</div>`;
  }
}
