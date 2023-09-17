---
title: "Database Transactions with 🐪 Perl"
description: "In this article, we will discuss about Database transactions and we how we can implement Database transactions in Perl."
pubDate: "May 15 2018"
heroImage: 'https://bizkt.imgix.net/posts/perl-db-transactions/perl_db_transactions.jpeg'
badge: "RETRO"
---

> The content of this article is migrated from the old blog post, so the information might be subject to updates.

To understand what a database transaction is, let's look at a simple bank withdrawal and deposit scenario. Imagine you have two bank accounts, A and B, and you want to withdraw some amount from account A and deposit it into account B.

What happens if you can't withdraw money from account A? Then the deposit into account B won't proceed. Similarly, if you can't deposit the money into account B, you'd need to deposit it back into account A (i.e., a rollback).

In the context of a database, a transaction refers to a sequence of jobs that are supposed to run as a unit; it either completes fully or not at all. For instance, in the following example, we have three database queries that should execute together. If the first query inserts data successfully, the second one should update a table, and the third one should delete an entry. If any of them fails for any reason, everything should revert to its initial state. The idea behind transactions is to ensure data integrity no matter what happens.

There are four properties of database transactions, known as ACID:

- **Atomic**: If one part of the transaction fails, the entire transaction fails, and the database state remains unchanged.
- **Consistency**: Only valid changes are accepted. If changes are invalid, the system reverts to the previous state.
- **Isolation**: Until a transaction is committed, its changes are not visible to other transactions.
- **Durability**: Once a valid change is committed, it remains in place.

You can find a detailed explanation about ACID [here](https://www.databricks.com/glossary/acid-transactions).

## Perl Example

First, let's install the necessary Perl and MySQL dependencies on a Debian system:

```bash
apt-get install libdbd-mysql-perl
cpan
> install DBI
```

Now, let's dive into our Perl script. I've used a hash to store the MySQL database configuration and another hash for connection attributes. You can also combine these hashes based on your needs.

**⚠️ Never commit sensitive information, such as database passwords, in version control systems. Seek alternative methods for secure storage.**

```perl
#!/usr/bin/perl
use strict;                                                              
use warnings;                                                       
use DBI;                     # Including the DBI module for databases

my %MYSQL = (
         hostname   =>  "localhost",
         username   =>  "root",
         password   =>  "password",
         database   =>  "customers"
);
my %ATTRIB = (
         RaiseError  =>  1,      # Enable error handling
         AutoCommit  =>  0       # Enable transactions
); 

# Establish a database connection
my $DB_CON = DBI->connect("dbi:mysql:$MYSQL{database}:$MYSQL{hostname}", "$MYSQL{username}", "$MYSQL{password}", \%ATTRIB) 
             || die("Couldn't connect to the Database!
");  

# Execute our sample transaction
eval {
    # Update query
    my $SQL_STR = "UPDATE cus_info SET cus_tp='$CUS_TP' WHERE cus_id=$CUS_ID";
    my $SQL_EXEC = $DB_CON->prepare($SQL_STR);
    $SQL_EXEC->execute();

    # Insert query
    $SQL_STR = "INSERT INTO product_main(prod_name,prod_stock) VALUES ('$PRODUCT_NAME','$PRODUCT_STOCK')";
    $SQL_EXEC = $DB_CON->prepare($SQL_STR);
    $SQL_EXEC->execute();

    # Delete query
    $SQL_STR = "DELETE FROM product_info WHERE prod_id='$PRODUCT_ID'";
    $SQL_EXEC = $DB_CON->prepare($SQL_STR);
    $SQL_EXEC->execute();

    # Commit if all queries were successful
    $DB_CON->commit();
};

# Rollback if any error occurred
if($@){
    print "Transactions were rolled back
";   
    $DB_CON->rollback();
}
# Note: '$@' will be set if our eval did not compile. For more details, refer to the [Perl documentation](#).

# Close the database connection
$DB_CON->disconnect();
```

[Access the sample program and database dump on this GitHub gist](https://gist.github.com/krishanthisera/9bb72d95da08560290e4751633063f10).

## Conclusion

A database transaction is a sequence of jobs meant to run as a single unit. There are four key properties related to database transactions:

- Atomic
- Consistency
- Isolation
- Durability
