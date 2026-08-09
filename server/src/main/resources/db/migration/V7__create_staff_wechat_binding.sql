create table staff_wechat_binding (
  id bigint unsigned primary key auto_increment,
  staff_id bigint unsigned not null,
  app_id varchar(64) not null,
  openid varchar(128) not null,
  enabled boolean not null default true,
  bound_at timestamp not null default current_timestamp,
  last_login_at timestamp null,
  unbound_at timestamp null,
  constraint fk_staff_wechat_binding_staff foreign key (staff_id) references staff_account(id),
  constraint uk_staff_wechat_binding_staff unique (staff_id),
  constraint uk_staff_wechat_binding_openid unique (app_id, openid)
);
