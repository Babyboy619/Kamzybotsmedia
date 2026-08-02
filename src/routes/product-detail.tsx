import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Loader2, ArrowLeft, Minus, Plus, ShoppingCart, Heart } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import MarketplaceChat from "@/components/marketplace/MarketplaceChat";
import { getExternalLog, purchaseExternalLog, type ExternalLogProduct } from "@/lib/api/logs";

type Product = ExternalLogProduct;
type ProductWithSeller = Product & { user_id?: string | null; seller_id?: string | null };

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetchProduct();
  }, [slug]);

  const fetchProduct = async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const log = await getExternalLog(slug);
      if (!log) {
        toast.error("Product not found");
        navigate("/products");
        return;
      }
      setProduct(log);
    } catch {
      toast.error("Unable to load product");
      navigate("/products");
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = (value: number) => {
    if (value > 0 && value <= (product?.stock || 0)) {
      setQuantity(value);
    }
  };

  const handleBuyNow = async () => {
    if (!user) {
      toast.error("Please login to purchase");
      navigate("/auth?redirect=/products/" + slug);
      return;
    }

    if (!product) return;

    const totalPrice = product.price * quantity;
    setPurchasing(true);

    try {
      const result = await purchaseExternalLog({ slug: product.slug, quantity });
      toast.success(`Successfully purchased ${quantity} ${quantity === 1 ? "item" : "items"}!`);
      navigate("/orders");
      console.info("External log purchase completed", result);
    } catch (err) {
      console.error("[Buy] error:", err);
      toast.error(err instanceof Error ? err.message : "An error occurred during purchase");
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-brand-orange" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <p className="text-muted-foreground mb-4">Product not found</p>
        <Button onClick={() => navigate("/products")} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Products
        </Button>
      </div>
    );
  }

  const totalPrice = product.price * quantity;
  const isOutOfStock = product.stock <= 0;

  return (
    <div className="w-full bg-background py-12 md:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => navigate("/products")} className="mb-8">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Products
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          {/* Product Image */}
          <div className="flex items-center justify-center bg-slate-100 rounded-lg overflow-hidden aspect-square">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-muted-foreground text-center">
                <p>No image available</p>
              </div>
            )}
          </div>

          {/* Product Details */}
          <div className="flex flex-col justify-start space-y-6">
            {/* Title & Status */}
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-brand-navy mb-3">
                {product.title}
              </h1>
              <div className="flex items-center gap-2">
                {isOutOfStock ? (
                  <Badge className="bg-red-100 text-red-700">Out of Stock</Badge>
                ) : product.stock < 5 ? (
                  <Badge className="bg-yellow-100 text-yellow-700">Only {product.stock} left</Badge>
                ) : (
                  <Badge className="bg-green-100 text-green-700">In Stock</Badge>
                )}
              </div>
            </div>

            {/* Price */}
            <div className="border-t border-b border-border py-4">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-brand-orange">
                  ₦{product.price.toLocaleString()}
                </span>
                <span className="text-sm text-muted-foreground">per unit</span>
              </div>
            </div>

            {/* Description */}
            {product.description && (
              <div>
                <h3 className="font-semibold text-brand-navy mb-2">Description</h3>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {product.description}
                </p>
              </div>
            )}

            {/* Quantity Selector */}
            <div>
              <h3 className="font-semibold text-brand-navy mb-3">Quantity</h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleQuantityChange(quantity - 1)}
                  disabled={quantity <= 1}
                  className="w-10 h-10 rounded-lg border border-border flex items-center justify-center hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="w-16 h-10 border border-border rounded-lg flex items-center justify-center font-semibold text-lg">
                  {quantity}
                </div>
                <button
                  onClick={() => handleQuantityChange(quantity + 1)}
                  disabled={quantity >= product.stock}
                  className="w-10 h-10 rounded-lg border border-border flex items-center justify-center hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <span className="text-sm text-muted-foreground ml-2">
                  {product.stock} available
                </span>
              </div>
            </div>

            {/* Total Price */}
            <Card className="bg-brand-orange/5 border-brand-orange/20">
              <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold text-xl text-brand-orange">
                    ₦{totalPrice.toLocaleString()}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {quantity} × ₦{product.price.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleBuyNow}
                disabled={isOutOfStock || purchasing}
                className="flex-1 bg-brand-orange hover:bg-brand-orange-hover text-white h-12 text-base font-semibold"
              >
                {purchasing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ShoppingCart className="w-5 h-5 mr-2" />
                )}
                {purchasing ? "Processing..." : "Buy Now"}
              </Button>
              <Button variant="outline" size="lg" className="h-12" disabled={isOutOfStock}>
                <Heart className="w-5 h-5" />
              </Button>
            </div>

            {/* Additional Info */}
            <MarketplaceChat
              productId={product.id}
              sellerId={
                (product as ProductWithSeller).user_id ??
                (product as ProductWithSeller).seller_id ??
                null
              }
            />

            <div className="border-t pt-6 space-y-3 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Delivery</span>
                <span className="font-semibold text-brand-foreground">Instant (after payment)</span>
              </div>
              <div className="flex justify-between">
                <span>Currency</span>
                <span className="font-semibold text-brand-foreground">{product.currency}</span>
              </div>
              <div className="flex justify-between">
                <span>Product ID</span>
                <span className="font-mono text-xs">{product.id.slice(-8)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
