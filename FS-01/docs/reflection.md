# Individual Reflection: Multi-Vendor E-Commerce Marketplace

**Author:** Akash Sharma  
**Project:** Multi-Vendor E-Commerce Marketplace (FS-01)  
**Track:** Nexvia Tech Internship — Full-Stack Web Development

---

## 1. What I Built

For my capstone project, I developed a full-stack multi-vendor e-commerce marketplace. The main idea was to create a platform where multiple sellers could manage their own products while customers could purchase items from different vendors through a single cart.

I wanted to build something closer to a real-world e-commerce application rather than another basic shopping website. So, I included features such as vendor management, commission calculation, payment verification, inventory handling, and order tracking.

The application has three types of users:

- **Customer:** Customers can browse products, search even when their search terms contain small spelling mistakes, add products to a Redis-backed cart, apply coupons, and complete payments through Razorpay. They can also track individual items, download PDF invoices, and review products after delivery.
- **Vendor:** Vendors can register their stores, add products with images, update stock, and manage orders. Each order item follows its own status, from `PLACED` to `PACKED`, `SHIPPED`, and finally `DELIVERED`.
- **Admin:** The admin manages vendor applications, approves or rejects registrations, sets commission percentages for individual vendors, creates coupons, and checks platform analytics, including revenue and top-selling products.

One feature I particularly wanted to get right was handling orders containing products from different vendors. Each vendor should be able to process their part of the order independently without affecting the other vendors.

## 2. How I Worked and What I Owned

I also want to be honest about my development process. This was my first time working on an application with several services communicating with each other, so there were quite a few things I had to figure out along the way.

I used an AI assistant as a pair programmer, especially when I got stuck with architectural decisions or unfamiliar concepts. For example, while working on the database structure, stock management, and Razorpay webhooks, I used it to understand different approaches and their advantages and disadvantages.

But I didn't want to depend on code that I couldn't explain. Whenever I used a suggested solution, I went through the implementation, ran it locally, and worked on understanding the errors and the reason behind the fix.

My actual responsibilities included:

- Setting up PostgreSQL, Redis, and Elasticsearch locally using Docker Compose on my Windows machine.
- Configuring Prisma, designing database models, running migrations, and preparing seed data.
- Developing the Express 5 backend with separate routes, controllers, services, and middleware.
- Building the React frontend, including components, routing, and context providers.
- Writing and debugging automated tests. The final test suite contains 36 passing tests covering authentication, checkout, payments, coupons, search, and stock-related race conditions.
- Deploying the application using Vercel, Render, Neon, Upstash, Elastic Cloud, and Supabase Storage.

There were several moments when something worked locally but failed after deployment, or when two services behaved differently than I expected. I had to investigate these issues on my own machine, try different fixes, and verify the results.

That debugging process was a big part of what I learned from this project.

## 3. What I Learned

Before this project, I had worked on smaller applications where most operations were relatively straightforward. This marketplace introduced me to problems that I hadn't really encountered in basic CRUD projects.

Some lessons stood out more than others.

**1. Why I started storing money in paise**

While implementing payments and vendor commissions, I realized that using JavaScript floating-point numbers for financial calculations could cause rounding issues.

For example, `0.1 + 0.2` does not produce exactly `0.3` in JavaScript. That might seem like a small issue, but in an application handling payments and commissions, even small calculation errors matter.

I switched to storing monetary values as integer paise and converting them into rupees only when displaying them. This made the calculations much more reliable.

**2. Why checking stock is not enough**

One problem I spent time understanding was preventing two customers from purchasing the last available unit at the same time.

Initially, checking whether stock was greater than zero seemed sufficient. But I learned that two requests could pass that check before either request updated the database.

To handle this, I used a conditional stock update inside a Prisma transaction. The database only reduces stock when enough quantity is available. If the condition fails, the request is handled with a `409 Conflict` response.

This helped me understand why database-level operations are important when multiple requests can arrive simultaneously.

**3. Payment verification must happen on the backend**

Razorpay integration was another area where I had to understand the complete payment flow rather than just connecting a frontend button.

The frontend should never be trusted to decide the final payment amount. The backend calculates the total using current product prices and creates the Razorpay order.

After payment, the server verifies the HMAC-SHA256 signature. I also worked on handling duplicate payment events because both the frontend callback and Razorpay webhook can report the same payment.

This introduced me to idempotency and why payment processing must be designed carefully to avoid duplicate order updates or payouts.

**4. Elasticsearch is not the primary database**

I initially thought of Elasticsearch mainly as a faster way to search products. While implementing synchronization, I understood why it should not be treated as the main database.

PostgreSQL stores the actual product data, whereas Elasticsearch maintains a searchable index. If the search service becomes unavailable or its data gets out of sync, the original product records are still safe in PostgreSQL.

I also understood why having a reindexing mechanism is useful in such an architecture.

**5. Order status needs to be managed at the item level**

This was one of the more important database design decisions in my project.

Consider a customer purchasing two products: one from Vendor A and another from Vendor B. Vendor A might ship their product today, while Vendor B might take another two days.

If I maintained only one status for the entire order, tracking these deliveries independently would become difficult.

So, I maintained the fulfillment status at the `OrderItem` level. This allowed each vendor to manage their products independently while keeping everything under one customer order.

## 4. A Problem I Got Stuck On

One debugging issue that I remember particularly well came up while testing product synchronization with Elasticsearch.

**What was happening?**

I had written a test for product deletion. The vendor would delete a product, and immediately afterwards, the test would search for that product in Elasticsearch.

Sometimes the deleted product was still appearing in the search results. It usually disappeared after approximately one second, but that was enough to make the test fail intermittently.

**What I investigated**

At first, I suspected that the database transaction was not committing properly. I also considered whether Redis was returning an old cached search result.

I disabled the Redis search cache in the test environment, but the problem continued.

After that, I went back to the Elasticsearch synchronization code and compared how I was handling product creation, updates, and deletion.

**What was actually wrong?**

I discovered that I had used `refresh: true` in the product creation and update operations, but had missed it in the delete operation.

Elasticsearch uses near-real-time indexing. A change is not necessarily visible in search results immediately unless the index is refreshed.

So, even though the deletion request had been processed, the search index had not refreshed when my test executed the next query.

**How I fixed it**

I added `refresh: true` to the Elasticsearch delete operation. After making this change, the deletion became immediately visible to the subsequent search request, and the test stopped failing intermittently.

This issue taught me something important: not every bug comes from incorrect business logic. Sometimes the problem is related to how different services handle updates and when those updates become visible.

It also made me appreciate automated testing because I probably would not have noticed this issue through normal manual testing.

## 5. What I Would Do Differently

Looking back, there are two things I would change if I started this project again.

**I would write integration tests earlier.**

I focused more on completing the application features initially and started writing most of the tests towards the later stages.

In hindsight, I should have tested important flows like checkout, stock reduction, and payment verification much earlier. That would have helped me catch edge cases before more features started depending on those flows.

**I would deploy a basic version much earlier.**

I completed a major part of the application locally before deploying it. That created some unnecessary debugging work later.

For example, I encountered Render cold starts, Upstash Redis TLS configuration requirements (`rediss://`), and other environment-specific issues.

If I had deployed a basic backend and database connection at the beginning, I could have identified these problems much sooner.

## 6. What I Would Build Next

There are still a few improvements I would like to make if I had another two weeks to work on this project.

**1. Automatically release stock from abandoned orders**

Currently, stock is reduced when checkout starts. If a customer opens the Razorpay payment window but leaves without completing payment, the stock remains reserved until the order is cancelled manually.

I would solve this by introducing a background worker using BullMQ or a scheduled job. It would check pending orders and automatically cancel unpaid orders after 30 minutes, restoring the reserved inventory.

**2. Integrate actual vendor payouts**

At the moment, the application calculates vendor earnings and stores payout information in the database. This is useful for maintaining financial records, but it does not actually transfer money to vendors.

I would explore Razorpay Route to support split settlements and automate vendor payouts after successful delivery.

**3. Improve performance and security**

During testing, I noticed that the product detail endpoint (`GET /api/products/:id`) was relatively slow because it involved multiple relational queries.

I would look into Redis caching for frequently accessed product details and implement proper cache invalidation whenever product information changes.

I would also improve authentication security by moving JWT storage from `localStorage` to HttpOnly cookies, along with the necessary CSRF protections and cookie configuration.

## 7. Conclusion

This project was a different experience from the smaller applications I had built before.

Initially, I was mainly focused on getting all the features working. But as the project became more complex, I started paying more attention to how different parts of the application interact with each other.

I learned about database transactions, concurrent requests, payment verification, search synchronization, caching, deployment, and automated testing. More importantly, I got to experience what happens when something works in one environment but breaks in another.

I also learned that building a working feature is only one part of development. Understanding why it works, knowing what can go wrong, and being able to debug it are equally important.

I still have things to improve, but I am much more comfortable working with full-stack applications now. I can also explain the major technical decisions I made in this project and the problems I encountered while implementing them.

Overall, this capstone gave me practical experience that I would not have gained from following tutorials alone.