---
title: "Why should you consider to adopt Service Mesh"
description: "This is a brief overview of why you should consider adopting Service Mesh with your existing Kubernetes cluster."
pubDate: "Jan 18 2021"
heroImage: 'https://bizkt.imgix.net/posts/istio-01/intro.jpeg'
---

This is a brief overview of why you should consider adopting Service Mesh with your existing Kubernetes cluster.
I'm not trying to demystify the concepts regards to Service Mesh but here I am trying to pitch some basic considerations you may take into account.
I should mention that if you are already an expert on the domain you can skip this. Especially, for this article, I will refer ISTIO.

Service Mesh, in terms of Kubernetes, is a relatively new concept in which I found it as a set of tools that enhance the capabilities of the Kubernetes ecosystem.

In this case, what are the enhancement that can be done to your existing Kubernetes architecture? Here I am not referring to your blog which is hosted in a Kubernetes
 cluster with a couple of containers but how about an infrastructure where it runs dozens of containers encapsulated in dozens of Kubernetes PODs or let's call them microservices?

- How do you manage the logs and traces?
- How do you manage the routes?
- How do you do the Load Balancing?
- How to make those microservices resilient?
- How do you handle the security and etc.

Likewise, I could list down more than a handful of concerns regards to the matter which means that Kubernetes does not solve all the problems. I am not trying to emphasise that,
Service Mesh is the silver bullet to all problems but depending on the context your traditional Kubernetes implementation may no longer accommodate your requirement.

Let me briefly go through the standard architecture of Service Mesh.

![mesh](https://bizkt.imgix.net/posts/istio-01/mesh.png)

Please note that this is a very high-level diagram. The Control plane may contain more than one component.

Generally, those sets of components in the service mesh can be categorized into control plane components and data plane components. As it is obvious, the control plane manages the service mesh while the data plane carries the actual workload of our microservices.

It is important to note that, Service Mesh is a combination of technologies. For example, for ISTIO Service Mesh, the envoy from "Lyft" has been used as their native sidecar proxy and you may use Kiali as your Service Dashboard. Further, Prometheus is a dependency for Kiali and other tools, which are meant to achieve observability.

In the context of the Service Mesh, microservices communicate to their subordinate microservices via a proxy. Especially, the proxy may run as a side container parallel to the original workload. The key point here is that, by having a sidecar proxy, Service Mesh addresses most of the concerns previously mentioned.

## Telemetry

One of the main reasons to associate Service Mesh with your Kubernetes cluster is to enhance observability.

- __Monitoring the services at a more concrete level__
- __Trace the traffic flows in a distributed manner__
- __Identify the services which cause the delays__
- __Oversees the service connectivity__
- __As mentioned, if you are using a service mesh, traffic between your microservice should flow through the respective sidecar proxy. Hence, it enables the control plane to collect the metrics regards to the traffic from the proxy.__

In terms of ISTIO, ISTIO uses Envoy as its native sidecar proxy. More importantly, the level of abstraction provided by ISTIO in which you are not required to directly configure those proxies.
ISTIO provides a handy set of Customer Resource Definition(CRD) to configure them.

__Kiali:__  can be used to inspect the connectivity between the services, and It's powerful that you can tune the traffic flow.

![kiali](https://bizkt.imgix.net/posts/istio-01/kiali.png)

__Jaeger:__ I would recall as my second favorite tool can be used to inspect the traces.

![jaeger](https://bizkt.imgix.net/posts/istio-01/jaeger.png)

__Prometheus:__ One of the most popular metric scraper
__Grafana:__ As your dashboard

![grafana](https://bizkt.imgix.net/posts/istio-01/grafana.png)

## Routing

I will summarise a couple of routing features that I have been using in production,

__Canaries:__ Canary releases or weighted routings are one of the most popular routing scenarios in the context of microservices.
Assume that you have a service with multiple versions, If you ought to split the traffic between those versions depending on the percentage, those are canaries.  
__Circuit Breakers:__ Say that, you have service A, B, and C, where A depend on B and B, depending on C, in a scenario where service C take too much time to respond,
 both A and service B will be affected. In this case, you may configure a Circuit breaker with a time-out that returns an acceptable response.
 ISTIO uses Circuit Breaking and Outlier Detection interchangeably.  
__Hidden Release:__ Have you ever tried testing in production? Say that you have a service with two versions. Version-1 is the production version and Version-2 is
 the newer version which is in the testing phase. You may deploy both versions on your mesh and use custom HTTP headers to direct the traffic to Version-2.  
__mTLS:__ The bonus feature which comes with ISTIO and other service meshes. You are no longer required to maintain SSL connectivities at the source code level.
Envoy proxy automatically does that for you. Say that you have 5-nodes Amazon EKS (Elastic Kubernetes Service). If you have multiple services (interconnect with each other),
your services may not be in the same node and you will never know the underlying physical connectivity between the nodes. Sometimes the traffic may flow through
different physical equipment (Switches. Routers, Servers) in the AWS datacentre.
By using SSL connectivity between proxies, service mesh secure your traffic without giving you any burden.
__Fault Injection:__  If you are required to test your application with a scenario where a service got crashed or was poorly reachable,
you can assign the service a delay response at the proxy level and observe the behaviour. This feature is much useful when you are executing chaos testing.  
__Traffic Mirroring:__ You can easily mirror the traffic from a particular service to another service.  

## Create your own ISTIO Playground

Lastly, for the time being, ISTIO document has some vague areas where those sections are not that clear. For example, ISTIO ingress with SSL certificates.
The following GIT repository will walk you through ISTIO implementation with Cert-Manager.  

[ISTIO with cert-manager](https://github.com/krishanthisera/istio-certman-poc)

Note that, this is a POC that I have designed and only describes the steps that you may follow to implement ISTIO with Cert-Manager.
It is heavily recommended to follow the official documentation for both ISTIO and Cert-Manger for better understanding.
