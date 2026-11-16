---
'tinyzoo': patch
---

Uploads no longer pass through the server's memory. A 9.9 MB file used to cost 426 MB of RAM (about 33 times its size, so one video or a few parallel uploads killed a 256 MiB pod), and a chunked upload without `Content-Length` skipped the size cap altogether (100 MB took 1.6 GB and ended in a 500). The body is now parsed as it arrives (`busboy`), written to a temporary file and moved or streamed on to the store (local disk: a rename; S3: one signed streaming PUT). The cap counts the bytes that really come in and answers `413` as soon as it is crossed, chunked or not. The upload's quota, rate limit and type checks are unchanged.

Also: the first bytes of a PDF, MP4, WebM or MP3 are checked like pictures were (a renamed text file called `video/mp4` is refused with 415); a picture over 80 megapixels is refused at upload with a message that states the limit (it used to upload and then answer 500 at every resized size), and a stored one that cannot be resized now answers with the original; a media field's `accept` is enforced when saving (422).
