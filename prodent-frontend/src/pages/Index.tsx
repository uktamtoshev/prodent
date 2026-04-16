import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Promotions from "@/components/Promotions";
import TopDoctors from "@/components/TopDoctors";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <Header />
      <main>
        <Hero />
        <Features />
        <Promotions />
        <TopDoctors />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
