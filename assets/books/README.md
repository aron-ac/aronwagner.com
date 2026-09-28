# Favorite book covers

The carousel catalog preserves Mark's original Amazon short links. Their public redirects were
resolved on September 28, 2026 to identify the exact editions below. The JPEG thumbnails are served
locally so the carousel does not depend on third-party image requests at runtime. They are unaltered
Amazon CDN thumbnails, 500–522 pixels tall, totaling about 254 KB.

All eleven downloaded images were visually checked against their titles, authors, and editions.
Book cover artwork remains the property of its respective publisher or rights holder.

| Catalog ID                      | ASIN / ISBN-10                                     | Linked edition                                | Amazon image source                                                                            |
| ------------------------------- | -------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| universal-principles-of-design  | [076037516X](https://www.amazon.com/dp/076037516X) | Updated and expanded third edition            | [Cover](https://m.media-amazon.com/images/I/81uMnSMfnIL._SY522_.jpg)                           |
| design-for-hackers              | [1119998956](https://www.amazon.com/dp/1119998956) | Reverse-Engineering Beauty                    | [Cover](https://images-na.ssl-images-amazon.com/images/P/1119998956.01._SCLZZZZZZZ_SY500_.jpg) |
| godel-escher-bach               | [0465026567](https://www.amazon.com/dp/0465026567) | An Eternal Golden Braid                       | [Cover](https://m.media-amazon.com/images/I/71Y6RuC+BvL._SY522_.jpg)                           |
| on-intelligence                 | [0805078533](https://www.amazon.com/dp/0805078533) | Paperback                                     | [Cover](https://images-na.ssl-images-amazon.com/images/P/0805078533.01._SCLZZZZZZZ_SY500_.jpg) |
| elements-of-computing-systems   | [0262640686](https://www.amazon.com/dp/0262640686) | Original edition, 2008 paperback              | [Cover](https://images-na.ssl-images-amazon.com/images/P/0262640686.01._SCLZZZZZZZ_SY500_.jpg) |
| code                            | [0137909101](https://www.amazon.com/dp/0137909101) | Second edition                                | [Cover](https://m.media-amazon.com/images/I/61Hc-9h+-XL._SY522_.jpg)                           |
| art-of-computer-programming     | [0137935102](https://www.amazon.com/dp/0137935102) | Volumes 1–4B boxed set                        | [Cover](https://m.media-amazon.com/images/I/719SYGJejmL._SY522_.jpg)                           |
| scalable-internet-architectures | [067232699X](https://www.amazon.com/dp/067232699X) | First edition                                 | [Cover](https://images-na.ssl-images-amazon.com/images/P/067232699X.01._SCLZZZZZZZ_SY500_.jpg) |
| zero-to-one                     | [0804139296](https://www.amazon.com/dp/0804139296) | Notes on Startups, or How to Build the Future | [Cover](https://m.media-amazon.com/images/I/61yR4tF4jzL._SY522_.jpg)                           |
| principles                      | [1501124021](https://www.amazon.com/dp/1501124021) | Life and Work                                 | [Cover](https://m.media-amazon.com/images/I/61LKD6scbfL._SY522_.jpg)                           |
| dont-make-me-think              | [0321965515](https://www.amazon.com/dp/0321965515) | Revisited, third edition                      | [Cover](https://m.media-amazon.com/images/I/71dgeGpVc4L._SY522_.jpg)                           |

Seven cover URLs were retrieved from publicly indexed Amazon product-page image metadata. Amazon's
public ASIN-based image CDN supplied the remaining four covers; no CAPTCHA or access controls were
bypassed. Additional primary sources confirming these four titles and authors:

- [Design for Hackers — Wiley](https://www.wiley-vch.de/en/areas-interest/computing-computer-sciences/design-for-hackers-978-1-119-99895-2)
- [On Intelligence — Macmillan](https://us.macmillan.com/books/9781429900454/onintelligence/)
- [The Elements of Computing Systems — MIT Press](https://mitpress.mit.edu/9780262140874/the-elements-of-computing-systems/)
- [Scalable Internet Architectures — InformIT / Sams](https://www.informit.com/store/scalable-internet-architectures-9780672326998)

Deployment only needs `catalog.json` and the JPEG thumbnails; this provenance document is not a
runtime asset.
