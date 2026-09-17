-- O totem envia o documento de impressão para a pasta da estação
CREATE POLICY "totem envia documento de impressao"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id = 'print-jobs' AND (storage.foldername(name))[1] = 'totem-1-printer');

-- A estação lê o arquivo (URL assinada de curta duração)
CREATE POLICY "estacao le documento de impressao"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'print-jobs' AND (storage.foldername(name))[1] = 'totem-1-printer');

-- Limpeza pode remover arquivos processados
CREATE POLICY "remover documento de impressao"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'print-jobs' AND (storage.foldername(name))[1] = 'totem-1-printer');