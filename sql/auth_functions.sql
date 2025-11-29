-- Habilita pgcrypto para bcrypt (solo se ejecuta una vez en la base)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Paso 2: función de login que delega la verificación a PostgreSQL
CREATE OR REPLACE FUNCTION fn_validar_login(
  p_username TEXT,
  p_password TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  valido BOOLEAN;
BEGIN
  SELECT (contrasena = crypt(p_password, contrasena))
    INTO valido
    FROM usuario
   WHERE username = p_username;

  RETURN COALESCE(valido, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Paso 4: función para crear usuarios con contraseña cifrada vía pgcrypto
CREATE OR REPLACE FUNCTION fn_crear_usuario(
  p_username TEXT,
  p_password TEXT,
  p_id_rol INTEGER,
  p_id_empleado INTEGER,
  p_id_estado INTEGER DEFAULT 1
)
RETURNS usuario AS $$
DECLARE
  nuevo usuario%ROWTYPE;
BEGIN
  INSERT INTO usuario (username, contrasena, id_rol, id_empleado, id_estado)
  VALUES (p_username, crypt(p_password, gen_salt('bf')), p_id_rol, p_id_empleado, COALESCE(p_id_estado, 1))
  RETURNING * INTO nuevo;

  RETURN nuevo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
