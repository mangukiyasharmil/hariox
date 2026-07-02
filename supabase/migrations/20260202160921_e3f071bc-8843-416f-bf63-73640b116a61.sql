-- Enable realtime for payments table to allow real-time notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;