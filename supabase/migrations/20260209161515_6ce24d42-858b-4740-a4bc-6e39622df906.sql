
-- Fix: Add 'received' to allowed status values for incoming messages
ALTER TABLE whatsapp_messages DROP CONSTRAINT whatsapp_messages_status_check;
ALTER TABLE whatsapp_messages ADD CONSTRAINT whatsapp_messages_status_check 
  CHECK (status = ANY (ARRAY['pending','sent','delivered','read','failed','received']));

-- Fix: Add more message types for incoming messages
ALTER TABLE whatsapp_messages DROP CONSTRAINT whatsapp_messages_message_type_check;
ALTER TABLE whatsapp_messages ADD CONSTRAINT whatsapp_messages_message_type_check 
  CHECK (message_type = ANY (ARRAY['text','image','document','template','button','interactive','audio','video','sticker','location','contacts']));
