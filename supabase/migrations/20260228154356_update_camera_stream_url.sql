DO $$
DECLARE
  target_camera_id UUID;
BEGIN
  SELECT id
    INTO target_camera_id
  FROM cameras
  WHERE lower(nome) LIKE '%sala 1%'
     OR lower(localizacao) LIKE '%sala de cultivo 1%'
  ORDER BY created_at
  LIMIT 1;

  IF target_camera_id IS NOT NULL THEN
    UPDATE cameras
    SET
      url_stream = 'http://192.168.68.61/capture',
      status = 'Ativa',
      updated_at = NOW()
    WHERE id = target_camera_id;
  ELSE
    INSERT INTO cameras (
      nome,
      localizacao,
      tipo,
      url_stream,
      status,
      resolucao,
      gravacao_ativa
    )
    VALUES (
      'ESP32-CAM Sala 1',
      'Sala de Cultivo 1',
      'Sala de Cultivo',
      'http://192.168.68.61/capture',
      'Ativa',
      'SVGA',
      false
    );
  END IF;
END $$;
