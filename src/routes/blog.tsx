import { motion } from "framer-motion";
import { Calendar, ArrowRight } from "lucide-react";
import { PageHero } from "@/components/sections/PageHero";
import { blogs } from "@/data/site";

export default function BlogPage() {
  return (
    <>
      <PageHero
        title="Blog"
        subtitle="Insights, tips and news about social media marketing."
        breadcrumbs={[{ name: "Blog" }]}
      />

      <section className="w-full bg-background py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-brand-navy mb-3 tracking-tight">
              Latest articles
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Stay updated with the latest tips and insights about social media marketing.
            </p>
          </motion.div>

          {blogs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              No articles available yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {blogs.map((blog, index) => (
                <motion.article
                  key={blog.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ y: -4 }}
                  className="bg-card rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all border border-border"
                >
                  <div className="aspect-video overflow-hidden">
                    <img
                      src={blog.image}
                      alt={blog.title}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-3">
                      <Calendar className="w-4 h-4" />
                      <span>{blog.date}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-brand-navy mb-3 line-clamp-2">
                      {blog.title}
                    </h3>
                    <p className="text-muted-foreground text-sm mb-4 line-clamp-3">
                      {blog.excerpt}
                    </p>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 text-brand-orange hover:text-brand-orange-hover font-medium text-sm transition-colors"
                    >
                      Read more
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.article>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
