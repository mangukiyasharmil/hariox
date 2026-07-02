import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PublicCompanyProvider, usePublicCompany } from "@/contexts/PublicCompanyContext";
import CapitalHeader from "@/components/capital/CapitalHeader";
import CapitalFooter from "@/components/capital/CapitalFooter";
import CapitalSupportWidget from "@/components/capital/CapitalSupportWidget";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Phone, User, MapPin, MessageSquare, Send, Headphones, Mail, Clock } from "lucide-react";
import ApplicationModal from "@/components/ApplicationModal";

const contactSchema = z.object({
  phone: z.string().min(10, "Enter a valid phone number").max(15),
  name: z.string().min(2, "Name is required").max(100),
  service: z.string().min(1, "Please select a service"),
  city: z.string().min(2, "City is required").max(100),
  message: z.string().min(5, "Message is required").max(1000),
  terms: z.literal(true, { errorMap: () => ({ message: "You must accept the terms" }) }),
});

type ContactForm = z.infer<typeof contactSchema>;

const services = [
  "Personal Loan", "Home Loan", "Business Loan", "Education Loan",
  "Vehicle Loan", "Gold Loan", "Loan Against Property", "Other",
];

const CapitalContactUsContent = () => {
  const { company } = usePublicCompany();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const companyName = company?.name || "Capital Hariox";

  const form = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
    defaultValues: { phone: "", name: "", service: "", city: "", message: "", terms: undefined },
  });

  const onSubmit = async (data: ContactForm) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("leads").insert({
        phone: data.phone,
        full_name: data.name,
        loan_type: "personal" as any,
        city: data.city,
        email: `${data.phone}@contact.form`,
        loan_amount: 0,
        monthly_income: 0,
        employment_type: "salaried" as any,
        source: "contact_us",
        company_id: company?.id || null,
        follow_up_notes: `Service: ${data.service}\nMessage: ${data.message}`,
      });
      if (error) throw error;
      toast.success("Message sent successfully! We'll contact you soon.");
      form.reset();
    } catch (err) {
      toast.error("Failed to send message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const contactInfo = [
    { icon: Phone, label: "Call Us", value: "+91 9422799318", href: "tel:+919422799318" },
    { icon: Mail, label: "Email", value: "hariox@gmail.com", href: "mailto:hariox@gmail.com" },
    { icon: Clock, label: "Working Hours", value: "Mon - Sat, 10AM - 7PM", href: null },
  ];

  return (
    <div className="min-h-screen bg-white">
      <SEOHead
        title="Contact Us | Get Instant Loan Help Today"
        description="Get in touch for all your loan needs. Quick response, expert guidance."
        keywords="contact, loan enquiry, capital hariox contact"
        canonicalUrl="https://capital.hariox.com/contact"
      />
      <CapitalHeader />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-gray-900 via-emerald-900 to-teal-900 overflow-hidden pt-20">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -left-32 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 py-16 md:py-24 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-2xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Headphones className="w-4 h-4" />
              We're Here to Help
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Contact Us
            </h1>
            <p className="text-lg text-gray-300">
              Have a question about loans? Need help with your application? Reach out — our team is ready to assist you.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <div className="lg:col-span-1 space-y-6">
            {contactInfo.map((item, idx) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">{item.label}</p>
                    {item.href ? (
                      <a href={item.href} className="text-gray-900 font-semibold hover:text-emerald-600 transition-colors">
                        {item.value}
                      </a>
                    ) : (
                      <p className="text-gray-900 font-semibold">{item.value}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
              className="bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl p-6 text-white"
            >
              <h3 className="text-lg font-bold mb-2">Need a Quick Loan?</h3>
              <p className="text-sm text-emerald-100 mb-4">Apply now and get approval within 24 hours.</p>
              <Button variant="secondary" size="lg" className="w-full" onClick={() => setIsModalOpen(true)}>
                Apply Now
              </Button>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="lg:col-span-2"
          >
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 md:p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Send us a Message</h2>
              <p className="text-gray-500 mb-6">Fill in the details below and we'll get back to you shortly.</p>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <div className="grid md:grid-cols-2 gap-5">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2"><User className="h-4 w-4" /> Name</FormLabel>
                        <FormControl><Input placeholder="Enter your name" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2"><Phone className="h-4 w-4" /> Phone Number</FormLabel>
                        <FormControl><Input placeholder="Enter your phone number" type="tel" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="grid md:grid-cols-2 gap-5">
                    <FormField control={form.control} name="service" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Services</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select a service" /></SelectTrigger></FormControl>
                          <SelectContent>{services.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="city" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2"><MapPin className="h-4 w-4" /> City</FormLabel>
                        <FormControl><Input placeholder="Enter your city" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="message" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Message</FormLabel>
                      <FormControl><Textarea placeholder="Write your message..." rows={4} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="terms" render={({ field }) => (
                    <FormItem className="flex items-start gap-3">
                      <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="mt-1" /></FormControl>
                      <FormLabel className="text-sm leading-snug cursor-pointer font-normal">
                        I accept the <a href="/terms-conditions" className="text-emerald-600 underline">Terms & Conditions</a> and <a href="/privacy-policy" className="text-emerald-600 underline">Privacy Policy</a>
                      </FormLabel>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" size="lg" className="w-full md:w-auto bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white" disabled={isSubmitting}>
                    <Send className="h-4 w-4 mr-2" />
                    {isSubmitting ? "Sending..." : "Send Message"}
                  </Button>
                </form>
              </Form>
            </div>
          </motion.div>
        </div>
      </main>

      <CapitalFooter />
      <StickyMobileCTA />
      <CapitalSupportWidget />
      <ApplicationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};

const CapitalContactUs = () => (
  <PublicCompanyProvider slug="capital">
    <CapitalContactUsContent />
  </PublicCompanyProvider>
);

export default CapitalContactUs;
