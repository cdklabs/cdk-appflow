Read: https://docs.snowflake.com/en/user-guide/data-load-s3-config-storage-integration

Snowflake first:
1. Create the Snowflake components
2. With this create storage integration with some dummy IAM Role and S3 bucket values
   IMPORTANT: each time the storage integration is created/replaced a new STORAGE_AWS_EXTERNAL_ID is generated, so this operation should be done once
3. run `DESC INTEGRATION <my_integration_name>`
4. save STORAGE_AWS_IAM_USER_ARN - this is static per an account
5. save STORAGE_AWS_EXTENRAL_ID - this can change so protect that

AWS second:
1. create the S3 Bucket, IAM policy and IAM role for the integration using the STORAGE_AWS_IAM_USER_ARN, STORAGE_AWS_EXTERNAL_ID values
2. create the profile for the connector profile

Snowflake again:
1. Run 

```sql
ALTER STORAGE INTEGRATION <my_integration_name>
SET 
  STORAGE_AWS_ROLE_ARN = <my_role_arn>
  STORAGE_ALLOWED_LOCATIONS = ('<my_s3_uri_with_prefix>');
```
If you run `CREATE OR REPLACE` Snowflake will change the external id and you'll need to get back to correctign the AWS part.