FROM pgvector/pgvector:0.8.7-pg18-trixie@sha256:5895949dfcdf308eb0cd31c950c93c14895c77f33fbedfecf1fa511ab1d4bcd2

ARG PG_JIEBA_REPO=https://github.com/jaiminpan/pg_jieba.git
ARG PG_JIEBA_COMMIT=d0ffac8028328b2566a889ff4db3d74ba63d1b42
ARG LIBJIEBA_COMMIT=391121d5db0f31dd5ce9795d4d34812f20eeb25c

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    cmake \
    g++ \
    git \
    make \
    postgresql-server-dev-18 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/pg_jieba_src

RUN git clone "${PG_JIEBA_REPO}" . \
  && git checkout "${PG_JIEBA_COMMIT}" \
  && test "$(git rev-parse HEAD)" = "${PG_JIEBA_COMMIT}" \
  && git submodule update --init --recursive \
  && git submodule status | grep -q "${LIBJIEBA_COMMIT}" \
  && mkdir build \
  && cd build \
  && cmake -DPostgreSQL_ADDITIONAL_VERSIONS=18 -DPostgreSQL_TYPE_INCLUDE_DIR="$(pg_config --includedir-server)" .. \
  && make -j"$(nproc)" \
  && make install

COPY xiaoshuyin_022_test.dict /tmp/xiaoshuyin_022_test.dict
RUN TSEARCH_DIR="$(pg_config --sharedir)/tsearch_data" \
  && install -m 0644 /tmp/xiaoshuyin_022_test.dict "${TSEARCH_DIR}/xiaoshuyin_022_test.dict" \
  && rm -f /tmp/xiaoshuyin_022_test.dict

WORKDIR /
