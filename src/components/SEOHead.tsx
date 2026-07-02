import { useEffect } from "react";

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  ogType?: string;
  canonicalUrl?: string;
  siteName?: string;
  jsonLd?: object | object[];
}

const SEOHead = ({
  title = "Get ₹10 Lakh Instant Personal Loan Online in 24 Hours",
  description = "Your trusted partner for all loan needs. Get fast loan approval up to ₹10 Lakh in just 24 hours. Home loans, business loans, personal loans with lowest interest rates starting from 8% p.a. Apply online now!",
  keywords = "loan, home loan, business loan, personal loan, education loan, vehicle loan, gold loan, fast loan approval, India, low interest rate, instant loan, quick loan, credit hariox, hariox finance, finance company",
  ogImage = "https://credit.hariox.com/icons/icon-512.png",
  ogType = "website",
  canonicalUrl,
  siteName,
  jsonLd,
}: SEOHeadProps) => {
  // Determine site name from domain
  const resolvedSiteName = siteName || (() => {
    const h = window.location.hostname.toLowerCase();
    if (h.includes('finance.hariox') || h.includes('finance-hariox')) return 'Finance Hariox';
    if (h.includes('capital.hariox') || h.includes('capital-hariox')) return 'Capital Hariox';
    return 'Credit Hariox';
  })();
  useEffect(() => {
    // Update document title
    document.title = title;

    // Update meta tags
    const updateMeta = (name: string, content: string, isProperty = false) => {
      const attr = isProperty ? "property" : "name";
      let meta = document.querySelector(`meta[${attr}="${name}"]`);
      if (meta) {
        meta.setAttribute("content", content);
      } else {
        meta = document.createElement("meta");
        meta.setAttribute(attr, name);
        meta.setAttribute("content", content);
        document.head.appendChild(meta);
      }
    };

    // Basic SEO
    updateMeta("description", description);
    updateMeta("keywords", keywords);

    // Open Graph
    updateMeta("og:title", title, true);
    updateMeta("og:description", description, true);
    updateMeta("og:image", ogImage, true);
    updateMeta("og:type", ogType, true);
    updateMeta("og:site_name", resolvedSiteName, true);
    if (canonicalUrl) {
      updateMeta("og:url", canonicalUrl, true);
    }

    // Twitter
    updateMeta("twitter:title", title);
    updateMeta("twitter:description", description);
    updateMeta("twitter:image", ogImage);

    // Canonical URL
    if (canonicalUrl) {
      let link = document.querySelector('link[rel="canonical"]');
      if (link) {
        link.setAttribute("href", canonicalUrl);
      } else {
        link = document.createElement("link");
        link.setAttribute("rel", "canonical");
        link.setAttribute("href", canonicalUrl);
        document.head.appendChild(link);
      }
    }

    // JSON-LD structured data — supports multiple schemas
    if (jsonLd) {
      // Remove existing JSON-LD scripts
      document.querySelectorAll('script[type="application/ld+json"]').forEach(el => el.remove());

      const schemas = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      schemas.forEach((schema) => {
        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.textContent = JSON.stringify(schema);
        document.head.appendChild(script);
      });
    }
  }, [title, description, keywords, ogImage, ogType, canonicalUrl, resolvedSiteName, jsonLd]);

  return null;
};

export default SEOHead;

// Default JSON-LD for the organization (LocalBusiness + FinancialService)
export const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": ["FinancialService", "LocalBusiness"],
  "name": "Credit Hariox",
  "legalName": "Hariox Corporate Services Pvt. Ltd.",
  "description": "Your trusted partner for all loan needs. Fast loan approval up to ₹10 Lakh in 24 hours.",
  "url": "https://credit.hariox.com",
  "logo": "https://credit.hariox.com/icons/icon-512.png",
  "image": "https://credit.hariox.com/icons/icon-512.png",
  "telephone": "+91-9422799318",
  "email": "hariox@gmail.com",
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+91-9422799318",
    "contactType": "customer service",
    "availableLanguage": ["English", "Hindi"],
    "areaServed": "IN"
  },
  "sameAs": [
    "https://facebook.com/credithariox",
    "https://instagram.com/credithariox"
  ],
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "D-1, 1st Floor, Yogi Nagar, Nr. Silver Business Hub, Bapa Sitaram Chowk, Simada",
    "addressLocality": "Surat",
    "addressRegion": "Gujarat",
    "postalCode": "395006",
    "addressCountry": "IN"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "21.1702",
    "longitude": "72.8311"
  },
  "openingHoursSpecification": {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    "opens": "10:00",
    "closes": "18:00"
  },
  "priceRange": "₹₹",
  "areaServed": "IN",
  "hasOfferCatalog": {
    "@type": "OfferCatalog",
    "name": "Loan Services",
    "itemListElement": [
      {
        "@type": "Offer",
        "itemOffered": {
          "@type": "LoanOrCredit",
          "name": "Personal Loan",
          "description": "Quick personal loans up to ₹10 Lakh"
        }
      },
      {
        "@type": "Offer",
        "itemOffered": {
          "@type": "LoanOrCredit",
          "name": "Home Loan",
          "description": "Home loans with competitive interest rates"
        }
      },
      {
        "@type": "Offer",
        "itemOffered": {
          "@type": "LoanOrCredit",
          "name": "Business Loan",
          "description": "Business loans for entrepreneurs"
        }
      }
    ]
  }
};

// FAQ data for JSON-LD
export const creditHarioxFaqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is the interest rate for personal loans?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Our personal loan interest rates start from just 8% p.a., varying based on your credit score, income, and loan amount. We work with 30+ banks and NBFCs to get you the best possible rate."
      }
    },
    {
      "@type": "Question",
      "name": "What documents are required to apply for a loan?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Basic documents include: Aadhaar Card, PAN Card, 3 months bank statements, latest salary slips (for salaried), ITR (for self-employed), and address proof."
      }
    },
    {
      "@type": "Question",
      "name": "How long does the loan approval take?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Once all documents are submitted and verified, loan approval typically takes 24-48 hours. For pre-approved customers with good credit scores, same-day disbursement is possible."
      }
    },
    {
      "@type": "Question",
      "name": "Is my personal information safe with you?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Absolutely! We use bank-grade encryption and follow strict data protection protocols. Your information is only shared with the bank/NBFC you choose for your loan application. We are RBI-compliant."
      }
    },
    {
      "@type": "Question",
      "name": "Can I apply for a loan if I have a low CIBIL score?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes! We work with multiple NBFCs that consider applicants with CIBIL scores as low as 600. Our experts can guide you on improving your score and finding suitable loan options."
      }
    }
  ]
};

// FAQ JSON-LD helper
export const createFaqJsonLd = (faqs: { question: string; answer: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": faqs.map(faq => ({
    "@type": "Question",
    "name": faq.question,
    "acceptedAnswer": {
      "@type": "Answer",
      "text": faq.answer
    }
  }))
});

// Standalone LoanOrCredit schema for richer SERP results on loan-intent pages
export const loanOrCreditJsonLd = {
  "@context": "https://schema.org",
  "@type": "LoanOrCredit",
  "name": "Personal Loan up to ₹10 Lakh",
  "description": "Instant personal loans up to ₹10 Lakh with 24-hour disbursal, starting at 8.5% p.a. interest.",
  "provider": {
    "@type": "FinancialService",
    "name": "Hariox",
    "url": "https://credit.hariox.com"
  },
  "loanTerm": {
    "@type": "QuantitativeValue",
    "minValue": 12,
    "maxValue": 60,
    "unitCode": "MON"
  },
  "amount": {
    "@type": "MonetaryAmount",
    "currency": "INR",
    "minValue": 50000,
    "maxValue": 1000000
  },
  "annualPercentageRate": {
    "@type": "QuantitativeValue",
    "minValue": 8.5,
    "maxValue": 24
  },
  "areaServed": { "@type": "Country", "name": "India" },
  "loanType": "Personal Loan",
  "currency": "INR"
};
