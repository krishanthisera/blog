---
title: "AWS Static Hosting - Part 02: CloudFront Edge Functions"
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

### Error Handling

Now, let's take a brief look at error handling. Suppose a request is made for a page that isn't available. Web servers typically return a "not found" page (404). Prerender should not cache these 404 pages; instead, it should inform the crawler that the request isn't valid.

For this scenario, Prerender offers a very cool solution 💡. You can embed the error code into your HTML using meta tags, allowing Prerender to detect and relay it back. In other words, you can map a status code using HTML meta tags.

For more information, visit <https://docs.prerender.io/docs/status-codes>.

We will discuss this more with an example code later in this article.  

## Implementation

Before diving into the code, I'd like to touch upon the setup. In the subsequent sections, I'll reference this repository (<https://github.com/krishanthisera/aws-edge-functions>).

This repository to used as a Terraform sub-module with the AWS Static Hosting module mention [here](https://github.com/krishanthisera/aws-static-hosting). The aim of aim this module is to deploy Lambda@Edge functions, facilitating prerender integration with CloudFront.

The repository can be divided into two sections,

1. Terraform IaC dedicated to the edge function deployment
2. A monorepo for the edge function's development and build

### Terraform IaC for edge function deployment

Now, let's narrow our focus to the Terraform code, setting aside the prerender and the theoretical aspects discussed earlier.

Our objective is to deploy a series of AWS Lambda functions. In this context, we must first build and test the code. Once satisfied, we can package and upload it as a Lambda function (AKA deploy).

Assume all build configurations have been preset for us. All we'd need to do is run a specific build command, which will compile the code on our behalf.

The function below executes the build command each time we run the terraform apply command. Here, we've defined null resources with provisioners:

1. To verify the presence of Node
2. To install dependencies and build the code.

```hcl
# build.tf
resource "null_resource" "check_node_version" {

  triggers = {
    always_run = timestamp()
  }

  provisioner "local-exec" {
    command     = "npx yarn version  --non-interactive"
    working_dir = "${path.module}/${var.edge_function_path}"

    interpreter = ["bash", "-c"]

    on_failure = fail
  }
}

resource "null_resource" "build_edge_functions" {

  triggers = {
    always_run = timestamp()
  }

  provisioner "local-exec" {
    command     = "npx yarn install  --non-interactive && npx yarn build"
    working_dir = "${path.module}/${var.edge_function_path}"

    interpreter = ["bash", "-c"]

    on_failure = fail
  }

  depends_on = [null_resource.check_node_version]

}
```

Now, we need to create a role and associate it with the Lambda function. This step enables us to utilize the Lambda function as a Lambda@Edge function:

```hcl
# data.tf
data "aws_iam_policy_document" "lambda_edge_assume_role_policy" {
  statement {
    sid       = "LambdaEdgeExecution"
    effect    = "Allow"
    actions   = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com", "edgelambda.amazonaws.com"]
    }
  }
}

# main.tf
resource "aws_iam_role" "lambda_edge_exec" {
  assume_role_policy = data.aws_iam_policy_document.lambda_edge_assume_role_policy.json
}
```

_*It's essential to specify both identifiers for Lambda@Edge functions. We will later associate this role with the function*_

Now, all that remains is to push the build artifacts to AWS. It's crucial to note that if we intend to associate these lambdas with CloudFront as Lambda@Edge functions, we must deploy them in the `us-east-1` region.

We'll go deeper into the build process later. For the time being, let's assume our build, or as I prefer to term it, our "packed" artifacts, are stored in a designated location. I will utilize Terraform locals to represent them in a more comprehensible format.

 We can utilize Terraform locals to display them in a more comprehensible manner.

 ```hcl
 # main.tf
 locals {
  edge_functions = [
    {
      name = "prerender-proxy"
      path = "${var.edge_function_path}/packages/prerender-proxy/build/index.js"
      handler = "index.handler"
    },
    {
      name = "filter-function"
      path = "${var.edge_function_path}/packages/filter-function/build/index.js"
      handler = "index.handler"
    },
    {
      name = "response-handler"
      path = "${var.edge_function_path}/packages/response-handler/build/index.js"
      handler = "index.handler"
    }
  ]
}

 ```

Here, I have defined a function by its name, specify its path, and indicate the handler.

We've defined three functions here. We'll discuss dig deeper into the specifics of each function later. For now, our primary task is to package each of them into separate zip files for deployment.

Now, we just need to define the Lambda configuration. I'll employ Terraform's count meta-argument to iterate over the locals.

```hcl
# main.tf
data "archive_file" "edge_function_archives" {
  count       = length(local.edge_functions)
  type        = "zip"
  source_file = "${path.module}/${local.edge_functions[count.index].path}"
  output_path = "${path.module}/${var.edge_function_path}/function_archives/${local.edge_functions[count.index].name}.zip"

  depends_on = [null_resource.build_edge_functions]
}
```

Here, for each function in local.edge_functions, an archive file will be created.

```hcl
# main.tf
resource "aws_lambda_function" "edge_functions" {
  # If the file is not in the current working directory you will need to include a
  # path.module in the filename.
  count         = length(local.edge_functions)
  filename      = "${path.module}/${var.edge_function_path}/function_archives/${local.edge_functions[count.index].name}.zip"
  function_name = "${local.edge_functions[count.index].name}"
  handler       = local.edge_functions[count.index].handler
  publish       = true
  memory_size   = 128
  role          = aws_iam_role.lambda_edge_exec.arn

  source_code_hash = data.archive_file.edge_function_archives[count.index].output_base64sha256

  runtime = "nodejs16.x"

}

resource "aws_iam_role" "lambda_edge_exec" {
  assume_role_policy = data.aws_iam_policy_document.lambda_edge_assume_role_policy.json
}
```

While each line of code is pretty self-explanatory, it's worth noting that we're associating the IAM role defined earlier.

Now, we need to think a couple of steps ahead, we can't solely rely on the lambda function names when associating them with CloudFront. We specifically need the ARN — more precisely, the ARN of a specific version. Since this will be a Terraform sub-module tied to our static hosting module (as recalled from article 01 😉), accessing these ARNs programmatically is essential.

Hence, the ARNs will be output as follows:

```hcl
# output.tf
output "function_arns" {
  value = {
    for function in aws_lambda_function.edge_functions :
    function.function_name => function.qualified_arn
  }
}
```

#### Static Hosting Stack

Let's delve into how we can associate our Lambda functions with CloudFront. For this segment, I'll be referencing the same repository I highlighted in the previous article. You can find it [here](https://github.com/krishanthisera/aws-static-hosting).

First we need to import our lambda at edge module.

```hcl
# edge-functions.tf
module "edge-functions" {
   source = "github.com/krishanthisera/aws-edge-functions.git"
}
```

Then we can associate our Lambda functions with our CloudFront distribution by simply referencing their names. Neat, right?

```hcl
resource "aws_cloudfront_distribution" "blog_distribution" {

  ...

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${var.bucket_name}"

    lambda_function_association {
      event_type   = "origin-request"
      lambda_arn   = module.edge-functions.function_arns["prerender-proxy"]
    }

    lambda_function_association {
      event_type   = "origin-response"
      lambda_arn   = module.edge-functions.function_arns["response-handler"]
    }

    lambda_function_association {
      event_type   = "viewer-request"
      lambda_arn   = module.edge-functions.function_arns["filter-function"]
    }

    forwarded_values {
      headers      = ["X-Request-Prerender", "X-Prerender-Host"]
      query_string = false

      cookies {
        forward = "none"
      }
    }
  }

   ...
}
```

With this, we've primarily addressed the Terraform and infrastructure components. Next, we'll discuss the specifics of the edge functions, focusing especially on the business logic and it's implementation.

### Edge functions

From this point on in our discussion, I'll be referencing the content inside the edge-functions directory of our aws-edge-functions repo.

This directory houses a monorepo for our edge functions. If you're unfamiliar with the term "monorepo", it stands for "monolithic repository". In a monorepo setup, multiple projects or components of a software application are stored within a single version control repository. So instead of managing distinct repositories for every project or component, everything is centralized.

In our setup, all our Lambda@Edge functions are located in the packages directory. These functions are written in TypeScript. When we build them, the TypeScript code for each edge function is transpiled into a single JavaScript package.

We manage dependencies using one main dependency/package management file (package.json) and have a single lock file (yarn.lock).

I've used esbuild for the build process. If you look inside each package, you'll find a file named esbuild.js. This file outlines how the application is built. Additionally, the package.json for each package contains the specified build script.

I've also used turbo repo to aid in the build process.

There are many tools out there to assist with this, but my main focus here isn't to explain the details of setting up a monorepo or how esbuild operates. We simply aim to transpile our TypeScript code to JavaScript so it can be used as a Lambda@Edge function.

#### Prerendering: The Business logic

Let's dive into the most crucial part of our discussion.

Imagine the scenario: our website has dynamic content, but search engines prefer static HTML for indexing. Our goal is to serve static HTML, rendered from our dynamic site, to these search engines.

To visualize our workflow, refer to the previously mentioned diagram:

![crawler requests]( https://bizkt.imgix.net/posts/edge-functions/edgefunction-naming.png )

The process kicks off when our CloudFront Distribution receives a request. We need to distinguish whether this request is from a search engine crawler or a regular user.

##### Step 1: Filtering Requests with Lambda@Edge | Filter Function

We'll employ a Lambda@Edge function to introduce a header, allowing us to later distinguish and appropriately handle requests during the CloudFront request flow.

Type script handler implementation for this is not complex

```ts
// edge-functions/packages/filter-function/src/index.ts
export const handler = async (event: CloudFrontRequestEvent): Promise<CloudFrontRequest> => {
  const request = event.Records[0].cf.request

  // Check if the request:
  // 1. Does not match any of the recognized file extensions
  // 2. Is from a recognized bot user agent
  // 3. Does not already have an x-prerender header
  if (
    !IS_FILE.test(request.uri) &&
    IS_BOT.test(request.headers["user-agent"][0].value) &&
    !request.headers["x-prerender"]
  ) {
    // Set x-request-prerender header to inform origin-request Lambda function
    request.headers["x-request-prerender"] = [
      {
        key: "x-request-prerender",
        value: "true",
      },
    ]

    // Set x-prerender-host header to the host of the request
    request.headers["x-prerender-host"] = [
      {
        key: "X-Prerender-Host",
        value: request.headers.host[0].value,
      },
    ]
  }

  return request
}
```

##### Step 2: Requesting the Prerender Service | Prerender Proxy

Having filtered requests coming from crawlers, our next step is to ask the prerender service to render the appropriate web page for us. This is a straightforward process: provide the webpage address and a token from the prerender service.

```ts
export const handler = async (event: CloudFrontRequestEvent): Promise<CloudFrontResponse | CloudFrontRequest> => {
  const request = event.Records[0].cf.request

  // If the request has the x-request-prerender header, it means the viewer-request function determined it should be prerendered
  if (request.headers["x-request-prerender"]) {
    // CloudFront alters requests for the root path to the default root object, /index.html.
    // However, when prerendering the homepage, this behavior is not desired.
    if (request.uri === `${PATH_PREFIX}/index.html`) {
      request.uri = `${PATH_PREFIX}/`
    }

    // Modify the request's origin to be the prerender service
    request.origin = {
      custom: {
        domainName: PRERENDER_URL,
        port: 443,
        protocol: "https",
        readTimeout: 60,
        keepaliveTimeout: 5,
        sslProtocols: ["TLSv1", "TLSv1.1", "TLSv1.2"],
        path: "/https%3A%2F%2F" + request.headers["x-prerender-host"][0].value,
        customHeaders: {
          "x-prerender-token": [
            {
              key: "x-prerender-token",
              value: PRERENDER_TOKEN,
            },
          ],
        },
      },
    }
  } else {
    if (request.uri.endsWith("/")) {
      request.uri += "index.html"
    } else if (!request.uri.includes(".")) {
      request.uri += "/index.html"
    }
  }

  return request
}
```

Once invoked, the Lambda@Edge function requests the prerender service to render our website. The prerender service, in turn, sends a new request to our CloudFront distribution, captures the rendered webpage, and returns it as a static HTML page.

###### Handling Errors

What happens if a page isn't available? Typically, we would present a default 404 page. However, the prerender service offers a cool solution. It allows us to specify a status code by embedding it within the error page's metadata:

`<meta name="prerender-status-code" content="404">`

You can read more about this [here](https://docs.prerender.io/docs/11-best-practices).  

##### Step 3: Responding with Static HTML | Response Handler

Once the prerender service completes its task and sends back the static HTML, our third Lambda@Edge function formats the response for the search engine crawler.

As part of this process, we also set cache control headers to dictate how the returned responses should be cached.

```ts
// edge-functions/packages/response-handler/src/index.ts

// Create an Axios client instance for HTTP requests.
// This instance is defined outside the Lambda function for reuse between calls.
const instance = axios.create({
  timeout: 1000, // Set request timeout
  maxRedirects: 0, // Disable following redirects
  validateStatus: (status) => status === 200, // Only consider HTTP 200 as a valid response
  httpsAgent: new https.Agent({ keepAlive: true }), // Use a keep-alive HTTPS agent
})

export const handler = async (event: CloudFrontResponseEvent): Promise<CloudFrontResponse> => {
  const response = event.Records[0].cf.response

  // If the x-prerender-requestid header is present, set cache-control headers.
  if (response.headers[`${cacheKey}`]) {
    response.headers["Cache-Control"] = [
      {
        key: "Cache-Control",
        value: `max-age=${cacheMaxAge}`,
      },
    ]
  }
  // If the response status isn't 200 (OK), fetch and set a custom error page.
  else if (response.status !== "200") {
    try {
      const res = await instance.get(errorPageUrl)
      response.body = res.data
      response.headers["content-type"] = [
        {
          key: "Content-Type",
          value: "text/html",
        },
      ]
      // Remove any pre-existing content-length headers as they might contain values from the origin.
      delete response.headers["content-length"]
    } catch (error) {
      // If fetching the custom error page fails, return the original response.
      return response
    }
  }
  return response
}
```

It's crucial to understand that regardless of the origin/source (S3 or Prerender), if the response isn't a 200 status code, we provide our own custom error page. This page is fetched on-the-fly by Axios, which sends a request to our website's 404 page. If you are following along with my previous article, I have get rid of the custom error page configuration from the CloudFront. See [here](https://github.com/krishanthisera/aws-static-hosting/commit/be22273ccbf8c3180e04108b705415d93a16d2fb?diff=unified)

## Wrapping it UP

Wrapping up, we've explored how to use AWS CloudFront edge functions and S3 for our static hosting needs.  Our main goal? Boosting our site's SEO prowess. We broke down how web crawlers work, comparing it to the usual browser requests. Digging deeper, we uncovered the foundation of our solution. In short, this article offers a roadmap for those wanting to optimize their static sites using AWS tools.
