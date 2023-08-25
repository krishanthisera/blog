---
title: "AWS Static Hosting - Part 03: Extending Edge Functions"
description: "In this article, we will focus on how we can leverage AWS CloudFront and S3 to set up our static hosting infrastructure."
pubDate: "Jan 12 2023"
heroImage: 'https://bizkt.imgix.net/posts/edge-functions/edge-functions-banner.png'
badge: "NEW"
---

Now this is a really important topic, when it comes to Lambda@Edge functions. If you are followed from my previous blog post on Lambda@Edge function, you see can we associate Lambda function handlers to specific CloudFront event. To get refresh our memories, please refer to the below diagram:

![Lambda at edge functions]( https://bizkt.imgix.net/posts/edge-functions/cloudfront-events-that-trigger-lambda-functions.png )

Now, CloudFront has a limitation here, well perhaps it is not a limitation but a Challenge for us engineer, it is, you can only associate one Lambda handler function for a particular event. What does it mean, whatever the logic that you would want to execute on particular even, should be encapsulated in a one handler functions.

Let me explain this further using our Lambda@Edge stack from the previous article.

## Bit of context

We had three Lambda@Edge functions right?

```hcl
...
  default_cache_behavior {
    ...

    lambda_function_association {
      event_type   = "viewer-request"
      lambda_arn   = module.edge-functions.function_arns["filter-function"]
    }

    lambda_function_association {
      event_type   = "origin-request"
      lambda_arn   = module.edge-functions.function_arns["prerender-proxy"]
    }

    lambda_function_association {
      event_type   = "origin-response"
      lambda_arn   = module.edge-functions.function_arns["response-handler"]
    }
...
}
```

So we assocaite them like,

- rerender-proxy    ➡️ origin-request
- response-handler  ➡️ origin-response
- filter-function   ➡️ viewer-request

Now this get more challenging when we want to add some additional logic to our Lambda@Edge functions. As we can not associate two handler function for a CloudFront event we need find proper work around. Of course we can, include this logic in the same function, but it is not quite right. As a good Engineers, we always prefer to maintain the modularity.

I know it is still bit unclear for you. Now let take a real world scenario. Assume that if we would want include a Lambda@Edge function to do GeoIP redirect.

So here is the thing, assume your website has two different versions based on the region. Based on the region of the request, where it is originating from, you would have a logic to redirect.

So the question is where would we put this logic. The most continent place is to put this logic is, associate it with Origin Request function. Why?, The `CloudFront-Viewer-Country` header, which we would take our redirect decision based on, is added by CloudFront after the Viewer Request phase. Therefore, during a Viewer Request event, this header is not yet available. If you want to access the CloudFront-Viewer-Country header, you should be using an Origin Request, Origin Response, or Viewer Response event.  

Hence, the most ideal event associate the GeoIP logic is `Origin-Request` event. Now, as we don't want mix bot the logic together, I would write separate geo ip redirect handler, which has it's own life cycle, and merge them together.

## How?

For this we would have to use some sort of middleware-like solution, which we can abstract away the complexity.

### Introducing Middy

Middy is a very simple middleware engine that allows us to simplify your AWS Lambda code when using Node.js.  

Learn more about Middy [here](https://middy.js.org/docs/)

#### How Middy work

So simply we would use middy to combine our two hanlder functions.

![middy-onion](https://bizkt.imgix.net/extending-edge-functions/middy-onion.png?w=664&h=547&fm=jpg)

When you attach a new middleware this will wrap the business logic contained in the handler in two separate steps.

When another middleware is attached this will wrap the handler again and it will be wrapped by all the previously added middlewares in order, creating multiple layers for interacting with the request (event) and the response.

This way the request-response cycle flows through all the middlewares, the handler and all the middlewares again, giving the opportunity within every step to modify or enrich the current request, context, or the response.

Execution order
Middlewares have two phases: before and after.

The before phase, happens before the handler is executed. In this code the response is not created yet, so you will have access only to the request.

The after phase, happens after the handler is executed. In this code you will have access to both the request and the response.

If you have three middlewares attached (as in the image above), this is the expected order of execution:

1. middleware1 (before)
2. middleware2 (before)
3. middleware3 (before)
4. handler
5. middleware3 (after)
6. middleware2 (after)
7. middleware1 (after)
Notice that in the after phase, middlewares are executed in inverted order, this way the first handler attached is the one with the highest priority as it will be the first able to change the request and last able to modify the response before it gets sent to the user.
