---
title: "HAProxy Implementation Case Study"
description: "This article covers the HAProxy deployment on firewall and SELinux-enabled CentOS 7 systems."
pubDate: "Feb 10 2018"
heroImage: 'https://bizkt.imgix.net/posts/hap-case-study/hap-case-study.jpg'
badge: "RETRO"
---

This tutorial covers the HAProxy deployment on firewall and SELinux-enabled CentOS 7 systems.

> The content of this article is migrated from the old blog post, so the information might be subject to updates.

## Introduction

First, let's get an overall idea about the situation.

I've bought a domain named `mycompany.com`, so all of my hosted sites should follow this main domain. For example, if someone searches for `london.mycompany.com`, they should reach the London server. Similarly, if someone looks for `chicago.mycompany.com`, they should reach the Chicago server.

I've created a Cloudflare account, pointed `mycompany.com` to our public IP address, and created two CNAME entries in Cloudflare for London and Chicago.

![CloudFlare DNS](https://bizkt.imgix.net/posts/hap-case-study/hap_cf_dns.png)

From Cloudflare, all requests to `mycompany.com` will be forwarded to our public address. HAProxy will then read these requests, process them, and forward them between two IIS servers.

![Connectivity](https://bizkt.imgix.net/posts/hap-case-study/hap_connectivity.png)

> **Note**: All HTTPS connections should terminate at HAProxy. Please see my post "HTTPS for HAProxy".

In this chapter, we will explore load balancing and ACL-based traffic routing between IIS web servers.

As the first step, I will add host entries to my hosts file:

```bash
vi /etc/hosts
10.0.3.121 iiswebsrv01
10.0.3.131 iiswebsrv02
```

You may do a ping and verify the connectivity between the HAProxy server and your web servers.

To download and enable the EPEL Repositories and install HAProxy:

```bash
wget http://dl.fedoraproject.org/pub/epel/epel-release-latest-7.noarch.rpm
rpm -ivh epel-release-latest-7.noarch.rpm
yum -y install haproxy
```

After the successful installation of HAProxy, you can start its configuration. Before editing the configuration file, it's recommended to keep a backup of the existing HAProxy configuration file:

```bash
cp /etc/haproxy/haproxy.cfg /etc/haproxy/haproxy.cfg_bak
```

### HAProxy Configurations

Now, let's examine our HAProxy configurations. The HAProxy configuration file contains four types of sections:

1. **Global Section**: Contains global configurations.
2. **Default Section**: Provides default configurations.
3. **Frontend Sections**: Exposed to the public to accept requests.
4. **Backend Sections**: Define how to serve the requests forwarded from the frontend section.

#### Global

```conf
global
    log 127.0.0.1   local2
    maxconn 1024
    user haproxy
    group haproxy
    daemon
    stats socket /var/run/haproxy.sock mode 600 level admin
    tune.ssl.default-dh-param 2048
```

- In the `global` section, we configure where to store our HAProxy logs. In this case, our HAProxy logs will be stored using the local rsyslog server.
- `maxconn 1024` specifies the maximum connection count that the HAProxy server should accommodate.
- The `user` and `group` directives define the HAProxy user and group, respectively, which were created during installation.
- The `daemon` directive indicates that HAProxy should run as a daemon process.
- The `stats socket` directive is used for monitoring performance via the status page or socket.
- `tune.ssl.default-dh-param 2048` sets the maximum size of the temporary DHE key for TLS.

#### Default

It's time to begin our configurations for HAProxy's Default Configuration. In the default section, we set the default parameters for both frontend and backend sections:

```conf
defaults
    log     global
    option  tcplog
    option  dontlognull
    retries 3
    option  redispatch
    maxconn 1024
    timeout connect 50000ms
    timeout client 500000ms
    timeout server 500000ms
```

- `log global`: This directive defines the log mode to use, which we have already set in the Global configuration.
- `option tcplog`: This enables logging at the TCP (Layer 4) level. Note that you can also use httplog if you wish to log at the HTTP level.
- `option dontlognull`: This directive filters the log entries, keeping your logs clean. By default, even a simple port probe produces a log. With this option, HAProxy avoids logging such entries.
- `retries 3`: Sets the number of retries after failed attempts to the server.
- `option redispatch`: If a server designated by a cookie is down, clients may still attempt to connect because they can't flush the cookie. This option allows HAProxy to break their persistence and redistribute them to a working server.
- `maxconn 1024`: Defines the maximum connection count.
- `timeout directives`: These set the maximum wait times for various activities.

Finally, the frontend and backend configurations

#### Frontend

In the frontend section, HAProxy accepts traffic from public entities, processes them, and forwards the traffic to the relevant backend. In the following frontend section, I will demonstrate how to read HTTP headers, process them with basic ACLs, and forward them to the corresponding backend sections.

```conf
frontend http_handler
    bind *:80
    bind *:443 ssl crt /etc/haproxy/certs/hrms.itcstaging.com-0001.pem
    mode http
    option httplog
    log global

    acl acl_london  hdr_beg(host) -i london
    acl acl_chicago hdr_beg(host) -i chicago

    use_backend be_london if acl_london
    use_backend be_chicago if acl_chicago
    default_backend be_welcome
```

- The frontend will accept all HTTP and HTTPS requests and process them using an ACL.
- To accept traffic from port 80 (HTTP) and 443 (HTTPS), we bind both ports to a frontend. For HTTPS traffic, an SSL certificate is required. For this tutorial, I've created an SSL certificate using [Let's Encrypt](https://letsencrypt.org).
- Since our primary objective is to read the HTTP headers and forward the traffic accordingly, we use `mode http`. If you use TCP mode instead, load balancing will be based on Layer 4, and you won't be able to read the HTTP header in your ACL.
- I've enabled HTTP logging of HTTP/HTTPS requests using option `httplog`.
- `log global` adds logs to the global syslog service.
- In HAProxy, an ACL is defined using the `acl` keyword. ACLs can be defined in either the backend or frontend sections. In our scenario, ACLs are defined in the frontend section. Two ACLs are created: one for London (`acl_london`) and one for Chicago (`acl_chicago`). These ACLs read the HTTP headers and forward traffic based on the content of these headers.
- The `use_backend` directive switches backends depending on the ACL output. For instance, if `acl_london` is true, traffic is sent to the London backend (be_london).
Traffic arriving at our frontends is tested against the ACLs, so it's essential to define our backends to accommodate HTTP requests and forward them to the intended destination.

#### Backend

```conf
backend be_london
    balance leastcon
    redirect scheme https if !{ ssl_fc }
    option forceclose
    option forwardfor
    stick match src
    stick-table type ip size 200k expire 30m
    mode http
    reqadd X-Forwarded-Proto:\ http
    cookie SERVERID insert indirect nocache
    option httpchk GET /check.aspx?testsrv=iiswebsrv01:8080
    http-check expect string 200\ OK
    server london_01 iiswebsrv01:94 cookie L01 check
    server london_02 iiswebsrv02:94 cookie L02 check
```

- `balance leastconn`: This directive specifies the load balancing algorithm to use. The `leastconn` algorithm selects the server with the fewest number of connections. It's recommended for longer sessions.
- `redirect scheme https if !{ ssl_fc }`: For security reasons, we prefer to use HTTPS. In the backend, this directive filters traffic to use only HTTPS. If a connection isn't secure, it redirects to HTTPS.
- `option forwardfor`: Enables the `X-Forwarding` for HTTP connections. When HAProxy acts as a reverse proxy, the server only sees the IP address of the HAProxy server as the client address. `X-Forwarding` allows HAProxy to append the original IP address of the client to the requests sent to the server.
- `stick match src` and `stick-table type ip size 200k expire 30m`: Configures the stickiness. Stick tables store learned data from the connection in memory. _*Note that restarting the service will remove these entries.*_
- `mode http`: Specifies that the backend will operate at the HTTP level.
- `reqadd X-Forwarded-Proto:\ http`: Adds a header to all HTTP requests passing through this backend.
- `cookie SERVERID insert indirect nocache`: Adds cookie values to HTTP requests.
- `option httpchk GET /check.aspx?testsrv=londonsrv01:8080` and `http-check expect string 200\ OK`: Before forwarding traffic to destination servers, HAProxy checks the availability of those servers using HTTP Check. If the server responds with `200 OK`, HAProxy considers it ready to serve.
- `server london_01 iiswebsrv01:94 cookie L01 check` and `server london_02 iiswebsrv02:94 cookie L02 check`: Define the backend servers. The check parameter tests the availability based on the aforementioned HTML script.

### Troubleshooting

To validate the configuration after completing the HAProxy setup:

```bash
haproxy -f /etc/haproxy/haproxy.cfg -c
```

To restart HAProxy:

```bash
systemctl restart haproxy
```

If you encounter any SELinux-related issues, especially when some destination ports are not allowed by SELinux, use the following command:

```bash
semanage port --add --type http_port_t --proto tcp <port>
```

To open firewall ports:

```bash
firewall-cmd --permanent --add-port= cp
firewall-cmd --reload
```

## Complete Configuration Sample

```conf
global
    log 127.0.0.1   local2
    maxconn 1024
    user haproxy
    group haproxy
    daemon
    stats socket /var/run/haproxy.sock mode 600 level admin
    tune.ssl.default-dh-param 2048

defaults
    log     global
    option  tcplog
    option  dontlognull
    retries 3
    option  redispatch
    maxconn 1024
    timeout connect 50000ms
    timeout client 500000ms
    timeout server 500000ms

frontend http_handler
    bind *:80
    bind *:443 ssl crt /etc/haproxy/certs/hrms.itcstaging.com-0001.pem
    mode http
    option httplog
    log global
    acl acl_london  hdr_beg(host) -i london
    acl acl_chicago hdr_beg(host) -i chicago
    use_backend be_london if acl_london
    use_backend be_chicago if acl_chicago
    default_backend be_welcome

backend be_london
    balance leastcon
    redirect scheme https if !{ ssl_fc }
    option forceclose
    option forwardfor
    stick match src
    stick-table type ip size 200k expire 30m
    mode http
    reqadd X-Forwarded-Proto:\ http
    cookie SERVERID insert indirect nocache
    option httpchk GET /check.aspx?testsrv=iiswebsrv01:8080
    http-check expect string 200\ OK
    server london_01 iiswebsrv01:94 cookie L01 check
    server london_02 iiswebsrv02:94 cookie L02 check

backend be_chicago
    balance leastcon
    redirect scheme https if !{ ssl_fc }
    option forceclose
    option forwardfor
    stick match src
    stick-table type ip size 200k expire 30m
    mode http
    reqadd X-Forwarded-Proto:\ http
    cookie SERVERID insert indirect nocache
    option httpchk GET /check.aspx?testsrv=iiswebsrv01:8080
    http-check expect string 200\ OK
    server london_01 iiswebsrv01:94 cookie L01 check
    server london_02 iiswebsrv02:94 cookie L02 check
```

## Sample HTTP Check HTML Script

```html
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
    <head>
        <title>
            HAP Health Check
        </title>
    </head>
    <body id="bodyID">
        200 OK
    </body>
</html>
```
