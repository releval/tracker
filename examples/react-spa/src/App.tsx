import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { Toaster, Toast } from '@chakra-ui/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { CatalogPage } from './pages/CatalogPage';
import { ProductPage } from './pages/ProductPage';
import { PromotionPage } from './pages/PromotionPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { toaster } from './toaster';

// The tracker lifecycle and one-time collector setup live in <TrackerProvider>
// (see main.tsx + setupTracking in tracker.ts), so App is just routing.
export function App() {
  return (
    <ChakraProvider value={defaultSystem}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="/product/:id" element={<ProductPage />} />
            <Route path="/promotion/:id" element={<PromotionPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
      <Toaster toaster={toaster}>
        {(toast) => (
          <Toast.Root>
            <Toast.Title>{toast.title}</Toast.Title>
            <Toast.Description>{toast.description}</Toast.Description>
            <Toast.CloseTrigger />
          </Toast.Root>
        )}
      </Toaster>
    </ChakraProvider>
  );
}
