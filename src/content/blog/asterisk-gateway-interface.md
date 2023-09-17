---
title: "Asterisk Gateway Interface"
description: "In this article, we will discuss the basics of the Asterisk Gateway Interface (AGI)."
pubDate: "May 10 2018"
heroImage: 'https://bizkt.imgix.net/post/asterisk-gateway-interface/asterisk_gateway_interface.png'
badge: "RETRO"
---

> The content of this article is migrated from the old blog post, so the information might be subject to updates.

See the Code snippets related to this article [here](https://gist.github.com/krishanthisera/177f2646443f3b56af907a0ab68ebbea).

## 1. What is the Asterisk Gateway Interface?

In simple terms, Asterisk Gateway Interface or AGI is a language-independent API that allows programmers to control the call flow on their Asterisk PBXs.

Asterisk offers more than just its own dial-plan to control call flow or call logic. You may use any of the following:

- Dialplan
- Asterisk Manager Interface (AMI)
- Asterisk Gateway Interface (AGI)

### Dialplan

Dial plan is Asterisk's native mechanism for handling the call logics. It's fast, easy to learn, and efficient. However, this configuration script is closer to assembly programming. A significant drawback of the Asterisk Dialplan is its lack of support for standard procedural languages, for instance, like creating loops.

In this article we will focus on AGI. However, it's worth noting that we need the Dialplan to initiate the AGI scripts.

### Asterisk Manager Interface (AMI)

Imagine having a remote control for your Asterisk PBX. That is AMI. It's more sophisticated compared to the Dialplan. Essentially, you can control your PBX using a TCP socket.

However, be cautious as this comes with some security concerns.

### Asterisk Gateway Interface (AGI)

If you compare AMI and Dialplan with AGI, AGI lies between them. AGI isn't entirely independent; it requires the support of the Dialplan. Moreover, AGI allows you to use your preferred language for scripting. In this tutorial, we'll be using Perl.

Before we dig deeper, if your PBX system solely handles outbound calls, AGI isn't for you, as AGI is designed primarily for inbound call handling.

There are four types of AGIs:

- **Standard AGI**: The simplest form, using standard inputs (STDIN) and outputs (STDOUT) to communicate with the PBX.
- **Dead AGI**: Handles call logic after a call has been hung up. Some AGI commands aren't available in this mode.
- **Fast AGI**: Allows you to offload AGI processing to another server, using TCP sockets. It offers all features found in Standard AGI.
- **EAGI**: For developers who need to communicate beyond the standard inputs and outputs, particularly if they need to access the media channel.

## 2. Scenario Discussion

We have two SIP peers named Peter and Bob. They should be able to call each other. If one is unavailable, the caller should have the option to leave a voicemail. The recipient can later access and listen to this voicemail by dialing an extension with '*' (e.g.,*101).

### Configuration

1. **SIP Peers**

```bash
sip.conf
[peter]
type=friend
secret=123
host=dynamic
allow=alaw,ulaw
context=users

[bob]
type=friend
secret=123
host=dynamic
allow=alaw,ulaw
context=users
```

2. **Dialplan Configuration**

```bash
extensions.conf
[users]
exten => _[*0-9]X.,1,NoOp("Dialing AGI")
same => n,AGI(dialplan.pl,${EXTEN})
```

3. **Voicemail Configuration**

```bash
voicemail.conf
[sales]
101 => 123,Bob's Mailbox,bob@example.com
102 => 321,Peter's Mailbox,peter@example.com
```

After configuring, reload your settings:

```bash
rasterisk
```

```bash
> sip reload
> sip show peers
> dialplan reload
> voicemail reload
> voicemail show users
```

### Perl Script for AGI

```perl
#!/usr/bin/perl
# Asterisk Dialplan Script
# This script handles dialplan routing for Asterisk.
use warnings;
use strict;

# Import necessary Perl modules
use Asterisk::AGI;

# Retrieve the dialed extension from the command line argument
our $DPLAN_EXTEN = $ARGV[0];

# Check if the dialed extension starts with an asterisk (*)
# If so, it's a voicemail box; otherwise, proceed with standard routing
if ($DPLAN_EXTEN =~ m/^\*/) {
    vm_box();
} else {
    main();
}

# Define call routes between two peers: Bob and Peter
sub main {
    my %EXTEN_CONF = (
        '101' => {
            'CHAN'       => 'SIP',
            'PEER'       => 'bob',
            'MAXWAIT'    => 5,
            'VM_CONTEXT' => 'sales',
        },
        '102' => {
            'CHAN'       => 'SIP',
            'PEER'       => 'peter',
            'MAXWAIT'    => 5,
            'VM_CONTEXT' => 'sales',
        },
    );
    
    my $AGI = new Asterisk::AGI;
    $AGI->exec('Dial', "$EXTEN_CONF{$DPLAN_EXTEN}{'CHAN'}/$EXTEN_CONF{$DPLAN_EXTEN}{'PEER'},$EXTEN_CONF{$DPLAN_EXTEN}{'MAXWAIT'}");
    $AGI->exec('VoiceMail', "$DPLAN_EXTEN\@$EXTEN_CONF{$DPLAN_EXTEN}{'VM_CONTEXT'}");
    $AGI->hangup();
}

# Listen to the Voice Mails
sub vm_box {
    my %VM_CONF = (
        '*101' => {
            'VM_BOX'     => '101',
            'VM_CONTEXT' => 'sales',
        },
        '*102' => {
            'VM_BOX'     => '102',
            'VM_CONTEXT' => 'sales',
        },
    );
    
    my $AGI = new Asterisk::AGI;
    $AGI->exec('VoiceMailMain', "$VM_CONF{$DPLAN_EXTEN}{VM_BOX}\@$VM_CONF{$DPLAN_EXTEN}{VM_CONTEXT}");
    $AGI->hangup();
}
```

The provided Perl script uses the `Asterisk::AGI`` module. This module allows for interaction with the Asterisk Gateway Interface. The script contains logic for routing calls and managing voicemail.

#### Setting Up the Perl Environment

Install the necessary build tools:

```bash
apt-get install build-essential
```

Access the CPAN shell:

```bash
cpan
```

Inside the CPAN shell, install the `Asterisk::AGI` module:

```bash
install Asterisk::AGI
```

(Exit the CPAN shell once the installation is complete.)

Setting up the AGI Script:

```bash
# Place the AGI script inside the Asterisk's agi-bin directory by navigating to:
cd /var/lib/asterisk/agi-bin

# Ensure the script has the correct ownership and execute permissions,
# Change the script's ownership to the Asterisk user:
chown asterisk:asterisk dialplan.pl

# Grant execute permissions to the script:
chmod u+x dialplan.pl
```

For detailed information on Asterisk Dialplan applications and their usage, refer to the Asterisk CLI or visit [voip-info.org](https://www.voip-info.org).

## Additional Resources

For further details and related code snippets, check out the Gist provided [here](https://gist.github.com/krishanthisera/177f2646443f3b56af907a0ab68ebbea).

---

Congratulations! Your Asterisk Gateway Interface is now set up and ready to use. Enjoy!
