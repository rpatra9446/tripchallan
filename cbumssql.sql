PGDMP      :                }            cbums    17.4    17.4 3    t           0    0    ENCODING    ENCODING        SET client_encoding = 'UTF8';
                           false            u           0    0 
   STDSTRINGS 
   STDSTRINGS     (   SET standard_conforming_strings = 'on';
                           false            v           0    0 
   SEARCHPATH 
   SEARCHPATH     8   SELECT pg_catalog.set_config('search_path', '', false);
                           false            w           1262    244907    cbums    DATABASE     k   CREATE DATABASE cbums WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'en-US';
    DROP DATABASE cbums;
                     postgres    false                        2615    263867    public    SCHEMA     2   -- *not* creating schema, since initdb creates it
 2   -- *not* dropping schema, since initdb creates it
                     postgres    false            x           0    0    SCHEMA public    COMMENT         COMMENT ON SCHEMA public IS '';
                        postgres    false    5            y           0    0    SCHEMA public    ACL     +   REVOKE USAGE ON SCHEMA public FROM PUBLIC;
                        postgres    false    5            a           1247    263922    ActivityAction    TYPE     �   CREATE TYPE public."ActivityAction" AS ENUM (
    'CREATE',
    'UPDATE',
    'DELETE',
    'LOGIN',
    'LOGOUT',
    'TRANSFER',
    'ALLOCATE',
    'VIEW'
);
 #   DROP TYPE public."ActivityAction";
       public               postgres    false    5            [           1247    263892    EmployeeSubrole    TYPE     o   CREATE TYPE public."EmployeeSubrole" AS ENUM (
    'OPERATOR',
    'DRIVER',
    'TRANSPORTER',
    'GUARD'
);
 $   DROP TYPE public."EmployeeSubrole";
       public               postgres    false    5            ^           1247    263902    SessionStatus    TYPE     b   CREATE TYPE public."SessionStatus" AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED'
);
 "   DROP TYPE public."SessionStatus";
       public               postgres    false    5            y           1247    305814    TransactionReason    TYPE     �   CREATE TYPE public."TransactionReason" AS ENUM (
    'ADMIN_CREATION',
    'OPERATOR_CREATION',
    'COIN_ALLOCATION',
    'SESSION_CREATION'
);
 &   DROP TYPE public."TransactionReason";
       public               postgres    false    5            X           1247    263882    UserRole    TYPE     h   CREATE TYPE public."UserRole" AS ENUM (
    'SUPERADMIN',
    'ADMIN',
    'COMPANY',
    'EMPLOYEE'
);
    DROP TYPE public."UserRole";
       public               postgres    false    5            �            1259    263868    _prisma_migrations    TABLE     �  CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);
 &   DROP TABLE public._prisma_migrations;
       public         heap r       postgres    false    5            �            1259    263989    activity_logs    TABLE     l  CREATE TABLE public.activity_logs (
    id text NOT NULL,
    "userId" text NOT NULL,
    action public."ActivityAction" NOT NULL,
    details jsonb,
    "targetUserId" text,
    "targetResourceId" text,
    "targetResourceType" text,
    "ipAddress" text,
    "userAgent" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
 !   DROP TABLE public.activity_logs;
       public         heap r       postgres    false    5    865            �            1259    263956    coin_transactions    TABLE     ,  CREATE TABLE public.coin_transactions (
    id text NOT NULL,
    "fromUserId" text NOT NULL,
    "toUserId" text NOT NULL,
    amount integer NOT NULL,
    "reasonText" text,
    reason public."TransactionReason",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
 %   DROP TABLE public.coin_transactions;
       public         heap r       postgres    false    5    889            �            1259    263981    comments    TABLE     �   CREATE TABLE public.comments (
    id text NOT NULL,
    "sessionId" text NOT NULL,
    "userId" text NOT NULL,
    message text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
    DROP TABLE public.comments;
       public         heap r       postgres    false    5            �            1259    263948 	   companies    TABLE       CREATE TABLE public.companies (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    address text,
    phone text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);
    DROP TABLE public.companies;
       public         heap r       postgres    false    5            �            1259    263973    seals    TABLE     �   CREATE TABLE public.seals (
    id text NOT NULL,
    "sessionId" text NOT NULL,
    barcode text NOT NULL,
    "scannedAt" timestamp(3) without time zone,
    verified boolean DEFAULT false NOT NULL,
    "verifiedById" text
);
    DROP TABLE public.seals;
       public         heap r       postgres    false    5            �            1259    263964    sessions    TABLE     Y  CREATE TABLE public.sessions (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdById" text NOT NULL,
    "companyId" text NOT NULL,
    source text NOT NULL,
    destination text NOT NULL,
    status public."SessionStatus" DEFAULT 'PENDING'::public."SessionStatus" NOT NULL
);
    DROP TABLE public.sessions;
       public         heap r       postgres    false    862    862    5            �            1259    263939    users    TABLE     �  CREATE TABLE public.users (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    role public."UserRole" NOT NULL,
    subrole public."EmployeeSubrole",
    "companyId" text,
    "createdById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    coins integer
);
    DROP TABLE public.users;
       public         heap r       postgres    false    5    856    859            j          0    263868    _prisma_migrations 
   TABLE DATA           �   COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
    public               postgres    false    217   �E       q          0    263989    activity_logs 
   TABLE DATA           �   COPY public.activity_logs (id, "userId", action, details, "targetUserId", "targetResourceId", "targetResourceType", "ipAddress", "userAgent", "createdAt") FROM stdin;
    public               postgres    false    224   {F       m          0    263956    coin_transactions 
   TABLE DATA           t   COPY public.coin_transactions (id, "fromUserId", "toUserId", amount, "reasonText", reason, "createdAt") FROM stdin;
    public               postgres    false    220   `^       p          0    263981    comments 
   TABLE DATA           S   COPY public.comments (id, "sessionId", "userId", message, "createdAt") FROM stdin;
    public               postgres    false    223   �_       l          0    263948 	   companies 
   TABLE DATA           ^   COPY public.companies (id, name, email, address, phone, "createdAt", "updatedAt") FROM stdin;
    public               postgres    false    219   X`       o          0    263973    seals 
   TABLE DATA           `   COPY public.seals (id, "sessionId", barcode, "scannedAt", verified, "verifiedById") FROM stdin;
    public               postgres    false    222   �a       n          0    263964    sessions 
   TABLE DATA           l   COPY public.sessions (id, "createdAt", "createdById", "companyId", source, destination, status) FROM stdin;
    public               postgres    false    221   Wc       k          0    263939    users 
   TABLE DATA           �   COPY public.users (id, name, email, password, role, subrole, "companyId", "createdById", "createdAt", "updatedAt", coins) FROM stdin;
    public               postgres    false    218   e       �           2606    263876 *   _prisma_migrations _prisma_migrations_pkey 
   CONSTRAINT     h   ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);
 T   ALTER TABLE ONLY public._prisma_migrations DROP CONSTRAINT _prisma_migrations_pkey;
       public                 postgres    false    217            �           2606    263996     activity_logs activity_logs_pkey 
   CONSTRAINT     ^   ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);
 J   ALTER TABLE ONLY public.activity_logs DROP CONSTRAINT activity_logs_pkey;
       public                 postgres    false    224            �           2606    263963 (   coin_transactions coin_transactions_pkey 
   CONSTRAINT     f   ALTER TABLE ONLY public.coin_transactions
    ADD CONSTRAINT coin_transactions_pkey PRIMARY KEY (id);
 R   ALTER TABLE ONLY public.coin_transactions DROP CONSTRAINT coin_transactions_pkey;
       public                 postgres    false    220            �           2606    263988    comments comments_pkey 
   CONSTRAINT     T   ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);
 @   ALTER TABLE ONLY public.comments DROP CONSTRAINT comments_pkey;
       public                 postgres    false    223            �           2606    263955    companies companies_pkey 
   CONSTRAINT     V   ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);
 B   ALTER TABLE ONLY public.companies DROP CONSTRAINT companies_pkey;
       public                 postgres    false    219            �           2606    263980    seals seals_pkey 
   CONSTRAINT     N   ALTER TABLE ONLY public.seals
    ADD CONSTRAINT seals_pkey PRIMARY KEY (id);
 :   ALTER TABLE ONLY public.seals DROP CONSTRAINT seals_pkey;
       public                 postgres    false    222            �           2606    263972    sessions sessions_pkey 
   CONSTRAINT     T   ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);
 @   ALTER TABLE ONLY public.sessions DROP CONSTRAINT sessions_pkey;
       public                 postgres    false    221            �           2606    263947    users users_pkey 
   CONSTRAINT     N   ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);
 :   ALTER TABLE ONLY public.users DROP CONSTRAINT users_pkey;
       public                 postgres    false    218            �           1259    263998    companies_email_key    INDEX     Q   CREATE UNIQUE INDEX companies_email_key ON public.companies USING btree (email);
 '   DROP INDEX public.companies_email_key;
       public                 postgres    false    219            �           1259    263999    seals_sessionId_key    INDEX     U   CREATE UNIQUE INDEX "seals_sessionId_key" ON public.seals USING btree ("sessionId");
 )   DROP INDEX public."seals_sessionId_key";
       public                 postgres    false    222            �           1259    263997    users_email_key    INDEX     I   CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);
 #   DROP INDEX public.users_email_key;
       public                 postgres    false    218            �           2606    264055 -   activity_logs activity_logs_targetUserId_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT "activity_logs_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
 Y   ALTER TABLE ONLY public.activity_logs DROP CONSTRAINT "activity_logs_targetUserId_fkey";
       public               postgres    false    218    224    4798            �           2606    264050 '   activity_logs activity_logs_userId_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;
 S   ALTER TABLE ONLY public.activity_logs DROP CONSTRAINT "activity_logs_userId_fkey";
       public               postgres    false    4798    224    218            �           2606    264010 3   coin_transactions coin_transactions_fromUserId_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.coin_transactions
    ADD CONSTRAINT "coin_transactions_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;
 _   ALTER TABLE ONLY public.coin_transactions DROP CONSTRAINT "coin_transactions_fromUserId_fkey";
       public               postgres    false    218    4798    220            �           2606    264015 1   coin_transactions coin_transactions_toUserId_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.coin_transactions
    ADD CONSTRAINT "coin_transactions_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;
 ]   ALTER TABLE ONLY public.coin_transactions DROP CONSTRAINT "coin_transactions_toUserId_fkey";
       public               postgres    false    218    4798    220            �           2606    264040     comments comments_sessionId_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.comments
    ADD CONSTRAINT "comments_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES public.sessions(id) ON UPDATE CASCADE ON DELETE RESTRICT;
 L   ALTER TABLE ONLY public.comments DROP CONSTRAINT "comments_sessionId_fkey";
       public               postgres    false    221    223    4805            �           2606    264045    comments comments_userId_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.comments
    ADD CONSTRAINT "comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;
 I   ALTER TABLE ONLY public.comments DROP CONSTRAINT "comments_userId_fkey";
       public               postgres    false    223    218    4798            �           2606    264030    seals seals_sessionId_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.seals
    ADD CONSTRAINT "seals_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES public.sessions(id) ON UPDATE CASCADE ON DELETE RESTRICT;
 F   ALTER TABLE ONLY public.seals DROP CONSTRAINT "seals_sessionId_fkey";
       public               postgres    false    222    221    4805            �           2606    264035    seals seals_verifiedById_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.seals
    ADD CONSTRAINT "seals_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
 I   ALTER TABLE ONLY public.seals DROP CONSTRAINT "seals_verifiedById_fkey";
       public               postgres    false    4798    222    218            �           2606    264025     sessions sessions_companyId_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT "sessions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;
 L   ALTER TABLE ONLY public.sessions DROP CONSTRAINT "sessions_companyId_fkey";
       public               postgres    false    4801    219    221            �           2606    264020 "   sessions sessions_createdById_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT "sessions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;
 N   ALTER TABLE ONLY public.sessions DROP CONSTRAINT "sessions_createdById_fkey";
       public               postgres    false    218    221    4798            �           2606    264000    users users_companyId_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE SET NULL;
 F   ALTER TABLE ONLY public.users DROP CONSTRAINT "users_companyId_fkey";
       public               postgres    false    218    219    4801            �           2606    264005    users users_createdById_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
 H   ALTER TABLE ONLY public.users DROP CONSTRAINT "users_createdById_fkey";
       public               postgres    false    218    4798    218            j   �   x�m�A
�0��u{
��2yo&NzOP(M�`���#�K�_�|*�f�ʨAcC( BsO}gu+��b&l�[/��+D�S�R��*SG�s�}KP�c�mU� �рt���8�ӳ��f�wE�Ii\���Z����۰\?�D�	q\�q߶�0�      q      x��][o\��~���� <.�ś��x��_fmM�L�ڍȒӒgvv0�}��O���[�-lÂm��.�Ud�WuȢ�2S$�d$�> 㨲.*)���k�+<y��"���+�$b�?x��ɣ�'~9�^]�ӳ��G�<������s�w�J,���<h�ۈ���Ճ��?�b�L�!Τ;S��Jt�8��,� >� s�(ƣ�z�L[c+�y���w�^���w'����{���T�[�&z�QB0t\7�w*8/����¿����z��2��J��� �sR$f�� ���h����3�z+E�9��d,�a�y�
�BȘ�A�����w�^��ɓ:��a���wO^=:����fB�Y���O��$-�,�+��F�Nx��3iθ��՝'�(La&[�P	Nrӑ9<'Z�s����ѫo���Gh�3Z�!}��Hݶ�2O��(mD%�⌛�"�6!_X�u�
�GHN�dM��
k��7�Sdfl�d�Ą���	V<@0<dNӠ�h���������Z9IK�,.M`ԑd�lf�x��,9��6��+�<y����h���Ňw!O�H���t���uO�t�c������� ���ʧ��=~�v����6�fzu}}��;��1g�|�}�������d�g �����$^�ϟ�	ģ?�~�O���������|4g��_���$�|�V���<���Y�+]�y'c�#��^~z��G�Ƈ�}J���ե����ƫ����y���W��s!��Wa�<Rc]%r�>�����/˼S���͞Λ����囧���|����堀�b\�`���W�7>�|l�Y�J����[q�/_]��/h�kf�d`�ǫ��ɻ|}�߽�����:��˜�"8]�{����=���)�Q��z懕��'��8�=��Īw���4�������2A�� �l��酠f~�d�|�g��|�'׷d�q��j ̙2���si��С��|�p�ܢ�g{�������{�f2��^�P
�k=��l=V[z��S������͓�^OnַOc���f�������B�t�F�حbҀ%�Ɗ�vD��f�y�eZ+;�3٭5Y+-H�K
�m�V�����֛��o���K�i���+ӫql�C����h�l����˖5Z����OK΍P��>14�0A�@�Y�T^�����ׯ��|q۵�jW.R���Qua�DE2)��,Pp��&B'|O�>���_V��C�~�pF�Ћ*YjP���
 ��:Bc6f�p�a�����Fape�-��,F���xo�#��56�n=����Q�ww�8����t�@9}?%^ӟG\���f������S'��co�����k�D�8�ҙm~z�X�An��KĒ���m~z�����[��5A 'f�c��W�Q�N�V��<`�+=�O}�z������"���c/�qM@n��Kt4)�F���$˪{k�F��D)�l�*Z籗[�=��c/��ހ�챗��ר�x�-�1�Q�m{Y��#��౗8+"��F���Z1r�Ǿ%;�<�R�	M�{i�H(i�D�<�R�H��������^�s`��^�ݎ�
i���TM'��/�!���[��"[�&�Uw�l��Qt�����
U�ϜE'ys�az,85��@�����M>����d�?�buF���b��X,Y�²��!����0̛�y�s��
)iư
0�B�%xe�k�bM���bM��bM��bM������bkS@��EUg({1z����řr�=�Vx6p��F�g� �T<����1�����vt���l6`
�k���g�W���\��ٌN�7	[��@G�G��%��w#���J�g��x6kݑQ4��ٌ��'�.x6k�����h��>+�nx6�Ԣ[��L^@�Z���YG�'�g�Y�φ�3���0�zq�nx6�,0|<�B�vx6S��w�g����/���+��Ev����>y~>��ǹ���Y~�]0)�f�KBgY{��,X�=��}֊�8D�X�}�Q�B��)� ,�m��mFgM��AgM�AgM�AgM������3���K)ׂΈ���ov�3"��c�`:�ĪW��F��C�|��w����#���Ն(R�?:CY�Y����k�N.����2�d;�;wU���Fgĳ"��lCg$�D�w��J
���Vt�ڷ�4�3 �ն�1M�����"�W�)yF�n�R����gB:����"�nGg�1e�뮥n�g\��j����Oɳ{�ڷm|p6Ϝ��ͭ�z+�+�:oJ�:�*����p���|��g�e��k�3�!&����L8�K��f��2���vp��l/p��p/p��p/p���3��8hp&��wJ�grص���Vp6#���H�Ħ��Ang���r��l�
zk׼���fBn_p6|�����ft����M�L�[`�ټiA�j�E��{��x� ׉;�٬u�+�	�f���J�g���E:p8h�sĲ�Ĩz��ٌ�����:B�T8[�N6�������Vp6S$\7��Y��W�9u6��h�fp6��d1�\�#8[�͎���@�92kp�[���(fA�;^ǜ3�	�q���UB�A�g�)��E1�6���Ȝ��J�F��v��he+<��NF��(����.#�-���լ��m���>ࣹ�"i�J����3�k�dER�1F�DZ�����?]��DFJ(�Ӏ	!g��d	��6��F�AH�z�|�Aݡ�%B��p�eȽf$��<(��2~a!9�XFF1E�)$#J M;�J�6!���z�Q(!��H�4-f'�nC1&��F�QL*�r�t҂6�f�(�����$	,H
�H9a�N�������$����ad!�}s�~������ �x1ɗ7�z�fc�^6�7?�������6��B�'��?_A�p�����aW�������y�z8��_'�����'�_��'�@��O�[�oO�A>�yr�P~���7����g�;���;�|�㿯~{�����]~�%q�N^�⧓�+�՚��������`;�-v�"G��ʅ4*�S��0M�8�h
��6�G
~��A�ӜH��8��k�b�����d�l�x�P-3-�X-3�dSa�4����H���)�gG��Zҝ&W'
��썒�в�����J��I.;L����W��.,B�J3	1���'ަ߿<}��z�qrA }��7U'������d<`8�VW7�b~��������[O�>Lc>�]�Ŀ�=}}~:����1���jB���T&fb�9�E���� ��s�>����C*�:݅X���x�K0b�K�0Q�=ԯ����3��f��Y�.��H�p\CQm�=8#5��Pu%逐���:�a�dSkL��4�i��w��i�(��$���0� �X���1��C{0p���N�"�!���!�!�X�Y�5��-9ƔLc��h�J�hh�.U#��3���9s6����ȵ
�,��8�H�HF
]1ʒ鉺)�Y�&,,:SZK���!M�� �D*ڤl�)��p�}�Y=d���B�rm;%�F��+x�~х���푚bM9��|fJHni�*����u�쨓5o.���sBR@�
��u�-�ƚG#uX�XB�E���tɡD��E�b�"gQE��mU��6�ԋD'E�!���e
+P�62O��EAЃg�٩��ͯ%U��A���>� ��c�<JW���z�OyZ_���#FL�`Ȧ���̲��DA��h��A<�XS���J�ΐ�/��HA#fI�,Fϴ,1����ܼ
�V��0�3�ӄ����T-�#���l��1X8G<���~���벤Ŏ�,�&��jY�%	�@� t�~���\��P��5d�k���P��l�e�B�H�%��G�*^��u%F!�U5mj�5W�9f8-JebL�Xj���F�X7`��'�RN{T����c	h�R� 0�=)���~q(5P�!r�>�t�h�P��S��D�A5�w���!b�\^?�����&�YF~} �  ೮;^-5@e-^]�Qx�ۈ6�
u���Ug- �$�c@U,@ր�`K�.�GϞ�|<�7��0��쯯.#�� ��/_���'��zukgn���ր��F���l��u�q����R���Kj��գ�=>�]��@ ;�Pd̂_K)ٺģ"�5�m���Z�U�Á?-T��&��3�)��3k�f<t�d����N��n��NwI��L0LN���,�\c��C�$7��������z�X�"Z��PW�tG��E���m�㸀J���m�N{�M���Hu���3EQ)T��k�os�7D�?Ed�6��s<0W �M
��vN�W��b��(Y�	|,�%�L(�	���mnzVT�v�{�}��d4B��}���
/Si\�}Η��:8,*�9����,����b�LUT�*ۈ6u��k��t�9���92-5{n=�?�B�څƩ��[px.��xY�_�QK���6& u�:Y˶S�j���,�Z[J�7��y&7��89Lɶ��3��Q;�[�%8�l��.�`L��Ŕ�"��3̉�	3׻�PzV���h�J�;��=(�
�+.���>x&kt!�zƌIa�hSԱ���Q���_T��<�S�dRd{���"2�����	sHe���En G`DQ[����3�>�ZK2 ���M�}��41ܧ�M�}��41�{��}�u��,�+?�?����"|x'cw���s����͂�P�bw����J\�*}3���v���͂����s��b�z�ث���P���\�fA�=�-u	�t��Z�pNY���z�)��l�=��WU��z,:jz�����7��:�:�^�f����,��7sbe{�w��Y˞�c�V�fN.�m8�P�fYvMU�C���(}�P�YL��o��-Ĺ���B[��o+}�h��F޽.��U1�$���X�F��}�[�f#��7�Ė9q��7-NtSћ�	Y���倪dS+��Z�3��J�}��yI�6GZ�P�P�����C�:�)R����X��s�
�[�m΄� �����}ӯ��DP(-�r2�By�zJFKDr�Xm\J�c.��)x(q'���v�k��\5�E3'�`����	,�����W̎h��uyS���s�ș� ��!Z[�@�pώ�.G�er����,Db!�Ȳ���$D	�̾��厢֎k} U���9�@��,j�;´&�\g"� A��kͧļȚ�X"F(ƅҜ�lb�O����>��&���:��=׹� �Z�!�P7c��2�nV��7e0]�QO�i�`I�-��j6O	њ�t5M�`�5h;2�C�
�.L;�:�g7g0m=w�pg��M��wg0m=��Ǜ�f0����j���z'|�����g0]Mt	��Z�E�����U�r���%������]��͉�]$wf0�#Dne{s���5�Y�Z㽦��A֗qО��5����t�4��޻E3�ۚ�ߑ��s�(9��u������o��>O���Oܙ�kS�ٿ����fS֒�=gYr!����.?柖{�<%�"y���v-�ok��z�Z�u��(g$K�P�d�a�֦�J�ƈhr#�:I�e�:�WRw���.h���ˤ2��b\���x@��W�zCY�XRp�u�F1,uG��7�!G�x@��)�^�z�ugE�c �^����Z�Hu)��*��ҏ�|P���;�4!�ls��ȅ9�#�*�C�ѽ�>$���@��t]7Y��6b%C8*����h+�{2�
>�3�3e(ܒ��0�D�_(��,2E&�A:/1�#ĺw�UuG��I��2	S�R�y�g�f�c�Vu�r�X�N���zp�r�20#�WH���5��~wY�?(	�X�Z$�
�R$f�� d��=$>0��t�N{�}����za� �y�/�Q*Y�d�~���`l�k�SAf�K$]�G!k>�~���A�ƪ��|P��,�w�軮�_�`�      m   !  x���KK�@��ɯ��z�Гy&'����,{�煁݌�,�}gQċ(4�Uu�/h�2��N҅:n�(0X�0�B�Ik �@ �q`I&@R<)C멢����B����Gm�%�Jc�����:ё�<͌���i���R^���N��>vxYbd���⯽;���OW�p{�{x��o��n|�Zl`9�8�\�(ٙ�ic�i�Rx	VtE,��s�%��7hRTHCX[�2yPF%地J�2�o��5.���v�.���_1��u|��ø����R5֨�����弄      p   �   x���;n1Ck�)�Z�c��\#mْ�����f�4dC���ds�P�O�n�R�����"D�1n`���e��ԓ앫�s�e$͙�0�1T��qV�V>^��*���x<o�[�Ӻ].9;���Eg�Es���#[���U�[4�i"S�Ւb	��%����bԛ�F�c�|^��E�F;      l   ;  x�u��j�0E��W��H���P���n�����I���.q����:��l�.�e���B�
(��yL�eh^�÷?�����Ŀy<�.�SW��9�)�N��aB�d��f�ڴ��:�x/F�J'�PJD��,�����b�V���xc9_�G��� S?l����h/Χ��#D�"b����V#2$����5�U�y��ZJ�H(�Κ�Hk.B��	��T#	�S\������u�L7�R�����C�����v{�@S��ť����c���cV��<�����R�塪�u�q/���y�      o   �  x���K�\1EǯV�����oYAO��d�
Ճ��$���p�}���8�NZm%$s�+0I��޸��@���AFWV�����5���)��@�Qo�O�~_�t����0��cӚ��j&n௤f
��!,�
r��+x�-�z=:N�h��aw���ա�����l���d=s�䎠��@�ܶ�ɨ��H��H���-�T�u���R��] wb�B�ke��(uQ��z��EX�N�(���) Y<�������Fy:�@ɡs�Sf)�Z��^+�$ܭjr�Μk(`�d"��~�}�d[�h�>]��G��|��$�Y�|M��+~5w�0s`,k�W���Em��R�O��(�+O��|D1G������w"ͮ���k0$zV eKh��<���Q���x<� _��|      n   �  x���Mj\1 ���S�4H�d�oۆRH��tY(��٤�Ez�:�P�Ue���1�-1Q�	'$�Rx�c(�I��)ǖ0)�@�#�=�.zR��E�4�8'���AhkNʘ7S)�k@ѴUb�)�jT��	c������|�y��h��y<�^���t{}�����SC���:_�̅��n�<f2�6���t$ڹ�O$tYiER�� �y�)"&�it��Z����y9�^XJ؜&�ǒ湤�;��4fqB{#yyS�|a��h�
`�c=�S�&�U������w,;�IT/!������͇����FT������l���'˙�wC�k�#�x'=�O�ZW-:���+i�F���-��Ь��СV
�����_�7kϙV�OhH�sO#Cn�I�Yj�7V�W�K��ֳ���������쯌_O���nX2�      k   �  x��VKS���_�`O;�3���"�(� �<jO��C @��6�Q�V��9��-R��鬵��[͡�+�$�Pa����m$'H'HEe��.O����q�/���,V���� ���N��H�e��HF�݌�n6k����U��J��F����t�=�iT�H�Z���j��Y��U���P����R���0�@
pr�q��1��[���v�A��(K0�pǌ�$�\��y�L2}��g��)����N����q<s���\��*?�H-:sA&Ž����i#���f6�V��]�{Y'�r�����Y� |`�$�RK0��wި�S�J��������'P��3�PaM+
�F;�t"��m�b�z���Ͳ�z>��M�����g~qG�����R�l����������[��EN+Q^�0��}���Z�%B��H�-P$�H$Q%_<����s����*�_�c)kmtS�YS����]�.�,�r�iۙԻ� -��bۿ7�J��˭���:�9)AY�2X~��l�XD����h��T:d�qo]nTa��W_�0�_���_c9@�G��5��u��v���U���>����y#]u{�l�^������+{�K�ǂ�o� �	
�x6���x��H;��E�c�?K�e���j��&��uf7��'�����>��p�W�MT���ʼ���&����i����-���&��[�y@D@rN�2�:�p)4k�����@���Ɲ�`��[55���~�����c��>��Y�f�=��f���>6H��6a�{C ���	�pD�1�a�O�x	I	�����o� ����F	���p@R'����ĿK1)�۴X>�q3�M���<>�n��v����>�;����������:�31^�f=N?�!��$a�>5a(4��PP[���FK��2�U�w<��[��	y���~Έ�R4�=�̛�'&�&ەa�g��U������v�ʽ�ŃIޞ��uo�)�!%��q���%�c?0��GW��#1<d #*�I��Ω2H�,�CA�}���/[}X���ppݎ{�1Ūu۴��<K�$�w�����m����~v݁�ytU~	�����X %�@z���jb#�N��'b�2!�V�#�2
��~��,����{_#���_B��w���Aq�+)�l�,G�p���˝ɨ[��IoQ�Uﵫ��_������R�~�E��p�!���qȽc�!����t� ƙgZ��y?�=���q�k�oɭ��Ӌ2��\]��E�Ɋ��ݓ�[_o����~���U���%�����s����N���c���w�øW��N��`k�[/�]�6�'a�Մ��5�`�)�]O��b+f�V�ݠ�a�X�+��!N�U~~swsy����c/�`>S��)|�4�DS��qa�>*��c��Y�0�d���x腟������O     