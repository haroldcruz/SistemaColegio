/**
 * @file MainService.gs
 * @description Funciones principales del servidor y enrutamiento de módulos.
 */

/**
 * ID de la hoja de cálculo principal utilizada por el sistema.
 */
const SPREADSHEET_ID = '1qJ96eOOfNxegq7GF_GdoH92bTiQuLLX51G1SGf3NoHI';

/**
 * Función principal que se ejecuta cuando se accede a la URL de la aplicación web.
 * Renderiza el dashboard principal.
 * @param {GoogleAppsScript.Events.AppsScriptHttpRequestEvent} e
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
function doGet(e) {
  return mostrarDashboard();
}

/**
 * Renderiza el dashboard principal de la aplicación web, verificando los permisos del usuario.
 * Si el usuario no está registrado, muestra un mensaje de acceso denegado.
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
function mostrarDashboard() {
  const email = Session.getActiveUser().getEmail();
  const usuario = obtenerUsuario(email);
  if (!usuario) {
    // Usuario no registrado o sin permisos
    return HtmlService.createHtmlOutput(`
      <h3>Acceso denegado</h3>
      <p>Usuario no registrado o permisos insuficientes.</p>
    `);
  }

  // Renderiza la vista principal del dashboard con los datos del usuario
  const template = HtmlService.createTemplateFromFile('ui_DashboardView');
  template.usuario = usuario;
  return template.evaluate().setTitle('Sistema Académico Jorge Volio');
}

/**
 * Función del lado del SERVIDOR que carga el contenido de un módulo solicitado.
 * Verifica permisos y retorna el HTML correspondiente.
 * @param {string} modulo - Nombre del módulo a cargar
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
function abrirModuloGS(modulo) {
  const email = Session.getActiveUser().getEmail();
  const usuario = obtenerUsuario(email);
  if (!usuario) {
    // Usuario no autenticado o sesión expirada
    return HtmlService.createHtmlOutput(`
      <h4>Error de Sesión</h4>
      <p>Usuario no autenticado o sesión expirada. Por favor, recarga la página.</p>
    `);
  }

  // Enrutamiento de módulos según el nombre y permisos del usuario
  switch (modulo) {
    case 'registro_RegistroView':
      // Solo administradores o usuarios con acceso a Registro Académico
      if (usuario.rol === 'Administrador' || usuario.acceso.includes('Registro Académico')) {
        try {
          // Retorna el HTML del módulo de registro
          return HtmlService.createHtmlOutputFromFile('registro_RegistroView').getContent();
        } catch (e) {
          // Error al cargar el módulo
          console.error(`Error al cargar RegistroModuloView: ${e.message}`);
          return HtmlService.createHtmlOutput(`<h4>Error Interno</h4><p>${e.message}</p>`);
        }
      } else {
        // Usuario sin permisos
        return HtmlService.createHtmlOutput(`<h4>Acceso Denegado</h4><p>No tienes permisos para este módulo.</p>`);
      }

    case 'usuarios_UsuariosView':
      // Solo administradores pueden acceder a la gestión de usuarios
      if (usuario.rol === 'Administrador') {
        try {
          // Retorna la vista principal de usuarios
          return HtmlService.createHtmlOutputFromFile('usuarios_UsuariosView').getContent();
        } catch (e) {
          // Error al cargar el módulo
          console.error(`Error al cargar usuarios_UsuariosView: ${e.message}`);
          return HtmlService.createHtmlOutput(`<h4>Error Interno</h4><p>${e.message}</p>`);
        }
      } else {
        // Usuario sin permisos
        return HtmlService.createHtmlOutput(`<h4>Acceso Denegado</h4><p>No tienes permisos para este módulo.</p>`);
      }

    case 'usuarios_FormularioAgregar':
      // Solo administradores pueden acceder al formulario de agregar usuario
      if (usuario.rol === 'Administrador') {
        try {
          // Retorna la vista del formulario de agregar usuario
          return HtmlService.createHtmlOutputFromFile('usuarios_FormularioAgregar').getContent();
        } catch (e) {
          // Error al cargar el módulo
          console.error(`Error al cargar usuarios_FormularioAgregar: ${e.message}`);
          return HtmlService.createHtmlOutput(`<h4>Error Interno</h4><p>${e.message}</p>`);
        }
      } else {
        // Usuario sin permisos
        return HtmlService.createHtmlOutput(`<h4>Acceso Denegado</h4><p>No tienes permisos para este módulo.</p>`);
      }

    default:
      // Módulo no encontrado
      return HtmlService.createHtmlOutput(`<h4>Módulo no encontrado</h4><p>El módulo solicitado no existe.</p>`);
  }
}