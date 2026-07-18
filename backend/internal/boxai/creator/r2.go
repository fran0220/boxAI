package creator

import (
	"context"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type s3Store struct {
	client    *s3.Client
	presigner *s3.PresignClient
	bucket    string
}

func (s *s3Store) PresignPut(c context.Context, k, m string, n int64) (string, error) {
	r, e := s.presigner.PresignPutObject(c, &s3.PutObjectInput{Bucket: aws.String(s.bucket), Key: aws.String(k), ContentType: aws.String(m), ContentLength: aws.Int64(n)}, func(o *s3.PresignOptions) { o.Expires = PresignTTL })
	if e != nil {
		return "", e
	}
	return r.URL, nil
}
func (s *s3Store) PresignGet(c context.Context, k string) (string, error) {
	r, e := s.presigner.PresignGetObject(c, &s3.GetObjectInput{Bucket: aws.String(s.bucket), Key: aws.String(k)}, func(o *s3.PresignOptions) { o.Expires = 15 * time.Minute })
	if e != nil {
		return "", e
	}
	return r.URL, nil
}
func (s *s3Store) Head(c context.Context, k string) (int64, error) {
	r, e := s.client.HeadObject(c, &s3.HeadObjectInput{Bucket: aws.String(s.bucket), Key: aws.String(k)})
	if e != nil {
		return 0, e
	}
	return aws.ToInt64(r.ContentLength), nil
}
func (s *s3Store) Delete(c context.Context, k string) error {
	_, e := s.client.DeleteObject(c, &s3.DeleteObjectInput{Bucket: aws.String(s.bucket), Key: aws.String(k)})
	return e
}
