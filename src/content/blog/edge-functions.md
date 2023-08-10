---
title: "AWS CloudFront edge functions"
description: "In this article, we will focus on how we can leverage AWS CloudFront and S3 to set up our static hosting infrastructure."
pubDate: "Jan 12 2023"
heroImage: 'https://bizkt.imgix.net/posts/static-hosting/tf-aws.jpg'
badge: "NEW"
---

In previous article we discuss how can put together AWS CloudFront, S3 and other associated services using Terraform to host our static website. Now we need to make our site SEO friendly, especially if our website has dynamic content.  

Before we get started, let's discuss some theory

## What does it mean: Pre-rendering a website

When a web crawler visits a website, it follows the same process as a regular user's browser: it sends request to the website's server, and in response, the server sends back the necessary files, such as HTML, CSS, JavaScript, and images. The web crawler uses this information to build an index of the website's content, which allows search engines to provide relevant results to users when they conduct searches.  

Now, to speed up this indexing process and provide a more efficient experience for search engines, pre-rendering comes into play. Pre-rendering involves sending a pre-rendered static HTML version of the webpage to the web crawler instead of just the server-side files. This pre-rendered version already contains all the essential content and is ready for the web crawler to process without the need for further rendering.

By providing a pre-rendered HTML version of the page to web crawlers, websites can ensure that search engines can quickly and accurately index their content. This can lead to better visibility in search engine results and an overall improved SEO (Search Engine Optimization) performance. It's a technique that benefits both the website owners and the search engines, as it allows for more efficient indexing and faster access to relevant content for users conducting searches.

## How we going to implement this?

As we are clear now what is Prerendering, we shall conquer what solution we going to use.  

There are more than hand full of solutions that we can use in this case, you should be able to come up with solution using your own programing language. But here we use, [prerender.io](https://docs.prerender.io/) as our solution.  

You can host it your own if you wish, you can follow the document [here](https://github.com/prerender/prerender).

For this article, I am going to use their cloud offering and it has a free tier.

## Let see what happen under the hood

First before we dig deeper into the solution, let's clarify a couple of basics.  

### Request categories

We can categories requests for the site based on client,

- Browser client: This is a regular human user
- Crawler: Web crawlers or bot who are visiting to website
- Prerender crawlers: To crawl the website with purpose of rendering

### So how can we identify them?

Browser clients and crawlers can be easily identified by looking at the `user-agent` header. For the prerender, prerender itself set `x-prerender` header, so we can use that header.

### CloudFront event and lambada at edge integration

![Lambda at edge functions]( https://bizkt.imgix.net/posts/edge-functions/cloudfront-events-that-trigger-lambda-functions.png )

In summary, by linking a CloudFront distribution with a Lambda@Edge function, CloudFront gains the ability to capture and handle requests and responses at its edge locations. This integration enables the execution of Lambda functions triggered by specific CloudFront events. These events encompass different stages in the request-response cycle:

1. __Viewer request event:__ This occurs when CloudFront receives a request from a viewer, meaning a user or a client attempting to access content through CloudFront.
2. __"Origin request" event:__ Before CloudFront forwards a request to the origin, this event takes place. The origin refers to the source server that holds the actual content being requested.
3. __"Origin response" event:__ CloudFront triggers this event when it receives a response from the origin server. The response contains the requested content.
4. __"Viewer response" event:__ This event happens just before CloudFront sends the response back to the viewer, ensuring any required modifications or customizations can be applied.

Refer [this](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-at-the-edge.html) for further information.

Alright, back to the original solution discussion.

## Ordinary Browser requests

![browser requests]( https://bizkt.imgix.net/posts/edge-functions/prerender-browser-requests.drawio.png )

## Crawlers and prerender request

Let us discuss what happens to the requests from crawlers.
Let's assume that the particular request has never been cached in prerender.

![crawler requests]( https://bizkt.imgix.net/posts/edge-functions/prerender-crawler-requests.png )

1. Crawler request hit the CloudFront  
   - CloudFront verify it is a crawler and it is not from prerender  
2. Then CloudFront talk to prerender (__I have a request from a crawler, please pass me the static/rendered webpage__)  
3. Then prerender, hold the current request from CloudFront, and send a brand-new request to CloudFront
   - CloudFront will validate that this request is from prerender
4. CloudFront would serve this request from prerender as a normal user requests
5. Then prerender render the content and respond to the CloudFront with static/rendered (HTML) web content
6. Finally CloudFront response to the Crawler with the static, content from Prerender
