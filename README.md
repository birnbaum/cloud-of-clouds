# cloud-of-clouds

Proof of concept for a multi user management solution on top of a cloud-of-clouds system.<br>
I designed and implemented the concept during my bachelor thesis.

The basis of this implementation is a simplified version of the DepSky<sup>1</sup> architecture. It is extended by additional encryption and an internal key management, to make certain files adressable to registered users and user groups inside a cloud-of-clouds.

This implementation is not secure in any way, as it is written in client side JavaScript (TypeScript) and relying on a third party API.


<sup>1</sup>http://dl.acm.org/citation.cfm?id=1966449
